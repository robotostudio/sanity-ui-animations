/**
 * Pure parsing behind `pnpm tokens:sync`: turns design.md and motion.md into
 * `DesignTokens`. Tables are found by their header text, never their
 * position, and every value that cannot be read falls back to the matching
 * value in `defaults` with one warning.
 *
 * Only type imports here, so `scripts/tokens-sync.ts` can load this file with
 * `node --experimental-strip-types` (which does not resolve extensionless
 * specifiers). The caller passes `DEFAULT_TOKENS` in as `defaults`.
 */

import type { SceneTheme } from "./scene-spec";
import type {
  BadgeTokens,
  DesignTokens,
  MotionRoleToken,
  SceneThemeTokens,
  SpringConfig,
  SpringToken,
} from "./tokens";

export type TokenSources = {
  designMd: string;
  motionMd: string;
};

export type ParsedTokens = {
  tokens: DesignTokens;
  /** One line per value that fell back to `defaults`. */
  warnings: string[];
};

type Table = {
  headers: string[];
  rows: Record<string, string>[];
};

const normalise = (text: string) => text.trim().toLowerCase();

/** Drop inline-code backticks and surrounding whitespace from a cell. */
const plain = (cell: string) => cell.replaceAll("`", "").trim();

/** Cells of one table row; `\\|` is a literal pipe inside a cell. */
const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replaceAll("\\|", "|").trim());

const isDelimiterRow = (line: string) =>
  /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(line.trim());

/** Every GitHub-flavoured Markdown table in `markdown`, in document order. */
function parseMarkdownTables(markdown: string): Table[] {
  const lines = markdown.split(/\r?\n/);
  const tables: Table[] = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index] ?? "";
    const delimiter = lines[index + 1] ?? "";
    if (!(header.trim().startsWith("|") && isDelimiterRow(delimiter))) {
      continue;
    }
    const headers = splitRow(header);
    const rows: Record<string, string>[] = [];
    let cursor = index + 2;
    while (lines[cursor]?.trim().startsWith("|")) {
      const cells = splitRow(lines[cursor] ?? "");
      rows.push(
        Object.fromEntries(
          headers.map((name, column) => [normalise(name), cells[column] ?? ""])
        )
      );
      cursor += 1;
    }
    tables.push({ headers: headers.map(normalise), rows });
    index = cursor - 1;
  }
  return tables;
}

/** The first table whose headers include every one of `headers`. */
function findTable(tables: Table[], headers: string[]): Table | undefined {
  const wanted = headers.map(normalise);
  return tables.find((table) =>
    wanted.every((name) => table.headers.includes(name))
  );
}

const rowFor = (table: Table | undefined, column: string, name: string) =>
  table?.rows.find(
    (row) => normalise(plain(row[column] ?? "")) === normalise(name)
  );

function parseCurve(
  cell: string
): Pick<MotionRoleToken, "easing" | "css"> | undefined {
  const text = plain(cell);
  if (normalise(text) === "linear") {
    return { easing: { type: "linear" }, css: "linear" };
  }
  const match = text.match(/^cubic-bezier\(([^)]*)\)$/);
  const points = match?.[1]?.split(",").map((value) => Number(value.trim()));
  if (points?.length !== 4 || points.some(Number.isNaN)) {
    return;
  }
  const [x1, y1, x2, y2] = points as [number, number, number, number];
  return {
    easing: { type: "cubic-bezier", points: [x1, y1, x2, y2] },
    css: `cubic-bezier(${points.join(", ")})`,
  };
}

const clauses = (cell: string) =>
  plain(cell)
    .split(/[,;]/)
    .map((clause) => clause.trim());

/**
 * The duration range: every clause that opens with `Nms` or `N to Mms`, so
 * "340ms open, 260ms close" reads as 260 to 340. Stagger clauses and the
 * glide's hop sentence are left out.
 */
function parseDuration(cell: string): MotionRoleToken["duration"] {
  const values = clauses(cell)
    .filter((clause) => !/stagger/i.test(clause))
    .flatMap((clause) => {
      const match = clause.match(/^(\d+)(?:ms)?(?:\s+to\s+(\d+))?ms\b/);
      if (!match) {
        return [];
      }
      return [Number(match[1]), Number(match[2] ?? match[1])];
    });
  if (values.length === 0) {
    return null;
  }
  return { minMs: Math.min(...values), maxMs: Math.max(...values) };
}

const numberIn = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  return match?.[1] === undefined ? undefined : Number(match[1]);
};

type Warn = (path: string, reason: string) => void;

/**
 * Where a value is read from: the text of its cell (or bullet), or why there
 * is none, e.g. "row missing from the Roles table".
 */
type Source = { text: string } | { missing: string };

const cellOf = (
  row: Record<string, string> | undefined,
  column: string,
  missing: string
): Source => (row ? { text: row[column] ?? "" } : { missing });

/**
 * One value: parsed from `source`, or `fallback` with a warning naming
 * `path`. A value with no fallback is optional and is dropped silently.
 */
function readValue<T>(
  warn: Warn,
  path: string,
  source: Source,
  parse: (text: string) => T | undefined,
  fallback: T | undefined,
  unreadable = (text: string) => `could not read "${plain(text)}"`
): T | undefined {
  const value = "text" in source ? parse(source.text) : undefined;
  if (value !== undefined || fallback === undefined) {
    return value;
  }
  warn(path, "text" in source ? unreadable(source.text) : source.missing);
  return fallback;
}

const nonEmpty = (text: string) => plain(text) || undefined;

const ROLE_EXTRAS = {
  staggerMs: ["duration", /(\d+)ms stagger/],
  risePx: ["duration", /(\d+)px rise/],
  maxItems: ["duration", /at most (\d+) items/],
  scaleFrom: ["use", /scale(?: from)? (\d*\.?\d+)/],
} as const satisfies Record<string, readonly [string, RegExp]>;

type RoleExtras = Pick<MotionRoleToken, keyof typeof ROLE_EXTRAS>;

function parseRole(
  fallback: MotionRoleToken,
  row: Record<string, string> | undefined,
  missing: string,
  warn: Warn
): MotionRoleToken {
  const path = `roles.${fallback.role}`;
  const cell = (column: string) => cellOf(row, column, missing);

  const curve = readValue(
    warn,
    `${path}.curve`,
    cell("curve"),
    parseCurve,
    fallback
  );
  const extras: RoleExtras = {};
  for (const [key, [column, pattern]] of Object.entries(ROLE_EXTRAS) as [
    keyof RoleExtras,
    (typeof ROLE_EXTRAS)[keyof RoleExtras],
  ][]) {
    const value = readValue(
      warn,
      `${path}.${key}`,
      cell(column),
      (text) => numberIn(plain(text), pattern),
      fallback[key],
      () => "not found in the Roles table"
    );
    if (value !== undefined) {
      extras[key] = value;
    }
  }

  return {
    role: fallback.role,
    use:
      readValue(warn, `${path}.use`, cell("use"), nonEmpty, fallback.use) ??
      fallback.use,
    easing: curve?.easing ?? fallback.easing,
    css: curve?.css ?? fallback.css,
    // `sweep` has no duration by design (null), so nothing to fall back to.
    duration:
      readValue(
        warn,
        `${path}.duration`,
        cell("duration"),
        (text) => parseDuration(text) ?? undefined,
        fallback.duration ?? undefined
      ) ?? null,
    ...extras,
  };
}

/** `{ type: "spring", stiffness: 400, … }` as a `SpringConfig`. */
function parseSpringConfig(cell: string): SpringConfig | undefined {
  const text = plain(cell);
  if (!/type:\s*"spring"/.test(text)) {
    return;
  }
  const field = (name: string) =>
    numberIn(text, new RegExp(`\\b${name}:\\s*(-?\\d*\\.?\\d+)`));
  const [duration, bounce] = [field("duration"), field("bounce")];
  if (duration !== undefined && bounce !== undefined) {
    return { type: "spring", duration, bounce };
  }
  const [stiffness, damping, mass] = [
    field("stiffness"),
    field("damping"),
    field("mass"),
  ];
  if (stiffness !== undefined && damping !== undefined && mass !== undefined) {
    return { type: "spring", stiffness, damping, mass };
  }
}

function parseSpring(
  fallback: SpringToken,
  row: Record<string, string> | undefined,
  missing: string,
  warn: Warn
): SpringToken {
  const path = `springs.${fallback.name}`;
  return {
    name: fallback.name,
    use:
      readValue(
        warn,
        `${path}.use`,
        cellOf(row, "use", missing),
        nonEmpty,
        fallback.use
      ) ?? fallback.use,
    config:
      readValue(
        warn,
        `${path}.config`,
        cellOf(row, "motion config", missing),
        parseSpringConfig,
        fallback.config
      ) ?? fallback.config,
  };
}

const HEX = /#[0-9a-f]{6}\b/gi;

const hexes = (cell: string) => plain(cell).match(HEX) ?? [];

/** A cell holding exactly one hex colour. */
const singleHex = (cell: string) => {
  const found = hexes(cell);
  return found.length === 1 && found[0] === plain(cell) ? found[0] : undefined;
};

const groundTones = (cell: string) => {
  const found = hexes(cell);
  return found.length === 5
    ? (found as SceneThemeTokens["groundTones"])
    : undefined;
};

const glassFill = (cell: string) => {
  const match = plain(cell).match(/^(#[0-9a-f]{6}) at (\d+(?:\.\d+)?)%$/i);
  return match?.[1] && match[2]
    ? { color: match[1], opacity: Number(match[2]) / 100 }
    : undefined;
};

type SceneColour = Exclude<
  keyof SceneThemeTokens,
  "groundTones" | "glassFill" | "trafficLight"
>;

/** Scene tokens rows that hold one plain colour, by their Token text. */
const SCENE_COLOURS: Record<string, SceneColour> = {
  card: "card",
  hairline: "hairline",
  text: "text",
  "secondary text": "secondaryText",
  tide: "tide",
};

function parseSceneTheme(
  theme: SceneTheme,
  fallback: SceneThemeTokens,
  table: Table | undefined,
  missingTable: string,
  warn: Warn
): SceneThemeTokens {
  const read = <T>(
    key: keyof SceneThemeTokens,
    token: string,
    parse: (text: string) => T | undefined,
    otherwise: T
  ) => {
    const source: Source = table
      ? cellOf(
          rowFor(table, "token", token),
          theme,
          "row missing from the Scene tokens table"
        )
      : { missing: missingTable };
    return (
      readValue(warn, `scene.${theme}.${key}`, source, parse, otherwise) ??
      otherwise
    );
  };

  const result: SceneThemeTokens = {
    ...fallback,
    groundTones: read(
      "groundTones",
      "ground tones",
      groundTones,
      fallback.groundTones
    ),
    glassFill: read("glassFill", "glass fill", glassFill, fallback.glassFill),
  };
  for (const [token, key] of Object.entries(SCENE_COLOURS)) {
    result[key] = read(key, token, singleHex, fallback[key]);
  }
  return result;
}

/** The text of the bullet that opens with `**Badges**`, backticks removed. */
function badgesBullet(markdown: string): Source {
  const line = markdown
    .split(/\r?\n/)
    .find((entry) => /^\s*[-*]\s+\*\*Badges\*\*/i.test(entry));
  return line === undefined
    ? { missing: 'no "Badges" bullet' }
    : { text: plain(line) };
}

function parseBadges(
  fallback: BadgeTokens,
  markdown: string,
  warn: Warn
): BadgeTokens {
  const bullet = badgesBullet(markdown);
  const read = <T>(
    path: string,
    parse: (text: string) => T | undefined,
    otherwise: T
  ) =>
    readValue(
      warn,
      `badges.${path}`,
      bullet,
      parse,
      otherwise,
      () => "not found in the Badges bullet"
    ) ?? otherwise;
  const hexAfter = (pattern: string) => (text: string) =>
    text.match(new RegExp(`${pattern}\\s*(#[0-9a-f]{6})\\b`, "i"))?.[1];
  const number = (pattern: RegExp) => (text: string) => numberIn(text, pattern);

  const colors = { ...fallback.colors };
  for (const status of Object.keys(colors) as (keyof typeof colors)[]) {
    colors[status] = read(
      `colors.${status}`,
      hexAfter(`\\b${status}`),
      colors[status]
    );
  }
  const percent = read(
    "fillOpacity",
    number(/(\d+(?:\.\d+)?)% fill/),
    fallback.fillOpacity * 100
  );
  return {
    heightPx: read("heightPx", number(/(\d+)px tall/), fallback.heightPx),
    dotPx: read("dotPx", number(/(\d+)px dot/), fallback.dotPx),
    fillOpacity: percent / 100,
    colors,
    neutral: {
      fill: read(
        "neutral.fill",
        hexAfter("neutral badge is"),
        fallback.neutral.fill
      ),
      border: read(
        "neutral.border",
        (text) => text.match(/(#[0-9a-f]{6}) border/i)?.[1],
        fallback.neutral.border
      ),
    },
  };
}

/**
 * Parse both guideline files into `DesignTokens`. Never throws: anything it
 * cannot read comes from `defaults`, with one warning per value.
 */
export function parseDesignTokens(
  sources: TokenSources,
  defaults: DesignTokens
): ParsedTokens {
  const warnings: string[] = [];
  const warn: Warn = (path, reason) => {
    warnings.push(`${path}: ${reason}, using the default`);
  };
  // motion.md holds every source today; design.md is searched after it in
  // case a table moves there.
  const tables = [
    ...parseMarkdownTables(sources.motionMd),
    ...parseMarkdownTables(sources.designMd),
  ];
  /** The row named `name`, or why there is none. */
  const lookup = (headers: string[], tableName: string) => {
    const table = findTable(tables, headers);
    const missing = table
      ? `row missing from the ${tableName} table`
      : `no table headed ${headers.join(" / ")}`;
    return {
      table,
      missing,
      row: (column: string, name: string) => rowFor(table, column, name),
    };
  };

  const rolesTable = lookup(["Role", "Use", "Curve", "Duration"], "Roles");
  const roles = defaults.roles.map((fallback) =>
    parseRole(
      fallback,
      rolesTable.row("role", fallback.role),
      rolesTable.missing,
      warn
    )
  );

  const springsTable = lookup(["Spring", "Use", "Motion config"], "Springs");
  const springs = defaults.springs.map((fallback) =>
    parseSpring(
      fallback,
      springsTable.row("spring", fallback.name),
      springsTable.missing,
      warn
    )
  );

  const sceneTable = lookup(["Token", "Light", "Dark"], "Scene tokens");
  const scene = {
    light: parseSceneTheme(
      "light",
      defaults.scene.light,
      sceneTable.table,
      sceneTable.missing,
      warn
    ),
    dark: parseSceneTheme(
      "dark",
      defaults.scene.dark,
      sceneTable.table,
      sceneTable.missing,
      warn
    ),
  };

  const badges = parseBadges(
    defaults.badges,
    `${sources.motionMd}\n${sources.designMd}`,
    warn
  );

  return {
    tokens: { ...defaults, roles, springs, scene, badges },
    warnings,
  };
}

export type DesignTokensRaw = {
  rawDesignMd: string;
  rawMotionMd: string;
  /** ISO timestamp of this sync. */
  syncedAt: string;
};

type SceneThemeFields = {
  groundTones: string[];
  glassFill: string;
  glassOpacity: number;
  card: string;
  hairline: string;
  text: string;
  secondaryText: string;
  tide: string;
  trafficLightActive: string;
  trafficLightInactive: string;
};

/**
 * The `designTokens` document, field for field as declared in
 * `apps/studio/schemaTypes/documents/design-tokens.ts`. Keep the two in step.
 */
export type DesignTokensDocument = {
  _id: "designTokens";
  _type: "designTokens";
  designMdUrl: string;
  motionMdUrl: string;
  syncedAt: string;
  roles: ({
    _key: string;
    _type: "motionRole";
    role: MotionRoleToken["role"];
    use: string;
    curve: string;
    minMs?: number;
    maxMs?: number;
  } & Pick<
    MotionRoleToken,
    "staggerMs" | "scaleFrom" | "risePx" | "maxItems"
  >)[];
  springs: {
    _key: string;
    _type: "spring";
    name: SpringToken["name"];
    use: string;
    duration?: number;
    bounce?: number;
    stiffness?: number;
    damping?: number;
    mass?: number;
  }[];
  sceneTokens: Record<SceneTheme, SceneThemeFields>;
  badges: {
    heightPx: number;
    dotPx: number;
    fillOpacity: number;
    success: string;
    warning: string;
    error: string;
    info: string;
    neutralFill: string;
    neutralBorder: string;
  };
  tide: { color: string; textColor: string; maxPerScene: number };
  windowChrome: {
    cornerRadiusPx: number;
    backdropBlurPx: number;
    topEdgePx: number;
    trafficLightDiameterPx: number;
    trafficLightGapPx: number;
    trafficLightInsetPx: number;
  };
  rawDesignMd: string;
  rawMotionMd: string;
};

const sceneThemeFields = (theme: SceneThemeTokens): SceneThemeFields => ({
  groundTones: [...theme.groundTones],
  glassFill: theme.glassFill.color,
  glassOpacity: theme.glassFill.opacity,
  card: theme.card,
  hairline: theme.hairline,
  text: theme.text,
  secondaryText: theme.secondaryText,
  tide: theme.tide,
  trafficLightActive: theme.trafficLight.active,
  trafficLightInactive: theme.trafficLight.inactive,
});

/**
 * The `designTokens` singleton as `pnpm tokens:sync` writes it. Array keys
 * are the role and spring names, so reruns write identical keys.
 */
export function toDesignTokensDocument(
  tokens: DesignTokens,
  raw: DesignTokensRaw
): DesignTokensDocument {
  const { badges, tide, windowChrome } = tokens;
  return {
    _id: "designTokens",
    _type: "designTokens",
    designMdUrl: tokens.source.designMdUrl,
    motionMdUrl: tokens.source.motionMdUrl,
    syncedAt: raw.syncedAt,
    roles: tokens.roles.map(
      ({ role, use, css, easing: _easing, duration, ...extra }) => ({
        _key: role,
        _type: "motionRole",
        role,
        use,
        curve: css,
        ...(duration && { minMs: duration.minMs, maxMs: duration.maxMs }),
        ...extra,
      })
    ),
    springs: tokens.springs.map(({ name, use, config }) => {
      const { type: _type, ...physics } = config;
      return { _key: name, _type: "spring", name, use, ...physics };
    }),
    sceneTokens: {
      light: sceneThemeFields(tokens.scene.light),
      dark: sceneThemeFields(tokens.scene.dark),
    },
    badges: {
      heightPx: badges.heightPx,
      dotPx: badges.dotPx,
      fillOpacity: badges.fillOpacity,
      ...badges.colors,
      neutralFill: badges.neutral.fill,
      neutralBorder: badges.neutral.border,
    },
    tide: {
      color: tide.color,
      textColor: tide.textColor,
      maxPerScene: tide.maxPerScene,
    },
    windowChrome: {
      cornerRadiusPx: windowChrome.cornerRadiusPx,
      backdropBlurPx: windowChrome.backdropBlurPx,
      topEdgePx: windowChrome.topEdgePx,
      trafficLightDiameterPx: windowChrome.trafficLightDiameterPx,
      trafficLightGapPx: windowChrome.trafficLightGapPx,
      trafficLightInsetPx: windowChrome.trafficLightInsetPx,
    },
    rawDesignMd: raw.rawDesignMd,
    rawMotionMd: raw.rawMotionMd,
  };
}
