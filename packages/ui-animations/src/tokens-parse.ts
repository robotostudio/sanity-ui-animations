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

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const isDelimiterRow = (line: string) =>
  /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(line.trim());

/** Every GitHub-flavoured Markdown table in `markdown`, in document order. */
export function parseMarkdownTables(markdown: string): Table[] {
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
  table?.rows.find((row) => normalise(plain(row[column] ?? "")) === name);

type Warn = (path: string, reason: string) => void;

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

type RoleExtras = Pick<
  MotionRoleToken,
  "staggerMs" | "risePx" | "maxItems" | "scaleFrom"
>;

/**
 * Stagger, rise, item cap and starting scale, written in prose inside the
 * Duration and Use cells. Only roles whose default has one must state it.
 */
function parseRoleExtras(
  fallback: MotionRoleToken,
  row: Record<string, string>,
  warn: Warn
): RoleExtras {
  const duration = row.duration ?? "";
  const found: RoleExtras = {
    staggerMs: numberIn(duration, /(\d+)ms stagger/),
    risePx: numberIn(duration, /(\d+)px rise/),
    maxItems: numberIn(duration, /at most (\d+) items/),
    scaleFrom: numberIn(plain(row.use ?? ""), /scale(?: from)? (\d*\.?\d+)/),
  };
  const extras: RoleExtras = {};
  for (const key of Object.keys(found) as (keyof RoleExtras)[]) {
    const value = found[key] ?? fallback[key];
    if (found[key] === undefined && value !== undefined) {
      warn(`roles.${fallback.role}.${key}`, "not found in the Roles table");
    }
    if (value !== undefined) {
      extras[key] = value;
    }
  }
  return extras;
}

function parseRole(
  fallback: MotionRoleToken,
  row: Record<string, string> | undefined,
  warn: Warn
): MotionRoleToken {
  const path = `roles.${fallback.role}`;
  if (!row) {
    warn(path, "row missing from the Roles table");
    return fallback;
  }

  const use = plain(row.use ?? "");
  if (!use) {
    warn(`${path}.use`, "empty");
  }

  const curve = parseCurve(row.curve ?? "");
  if (!curve) {
    warn(`${path}.curve`, `could not read "${plain(row.curve ?? "")}"`);
  }

  // `sweep` has no duration by design, so an empty reading is not a fallback.
  const duration = parseDuration(row.duration ?? "");
  if (!duration && fallback.duration) {
    warn(`${path}.duration`, `could not read "${plain(row.duration ?? "")}"`);
  }

  return {
    role: fallback.role,
    use: use || fallback.use,
    ...(curve ?? { easing: fallback.easing, css: fallback.css }),
    duration: duration ?? fallback.duration,
    ...parseRoleExtras(fallback, row, warn),
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
  warn: Warn
): SpringToken {
  const path = `springs.${fallback.name}`;
  if (!row) {
    warn(path, "row missing from the Springs table");
    return fallback;
  }
  const use = plain(row.use ?? "");
  if (!use) {
    warn(`${path}.use`, "empty");
  }
  const cell = row["motion config"] ?? "";
  const config = parseSpringConfig(cell);
  if (!config) {
    warn(`${path}.config`, `could not read "${plain(cell)}"`);
  }
  return {
    name: fallback.name,
    use: use || fallback.use,
    config: config ?? fallback.config,
  };
}

const HEX = /#[0-9a-f]{6}\b/gi;

const hexes = (cell: string) => plain(cell).match(HEX) ?? [];

/** A cell holding exactly one hex colour. */
const singleHex = (cell: string) => {
  const found = hexes(cell);
  return found.length === 1 && found[0] === plain(cell) ? found[0] : undefined;
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
  table: Table,
  warn: Warn
): SceneThemeTokens {
  const result: SceneThemeTokens = { ...fallback };
  const cell = (token: string) => {
    const row = rowFor(table, "token", token);
    if (!row) {
      return;
    }
    return row[theme] ?? "";
  };
  const read = <T>(
    key: keyof SceneThemeTokens,
    token: string,
    parse: (text: string) => T | undefined,
    assign: (value: T) => void
  ) => {
    const path = `scene.${theme}.${key}`;
    const text = cell(token);
    if (text === undefined) {
      warn(path, "row missing from the Scene tokens table");
      return;
    }
    const value = parse(text);
    if (value === undefined) {
      warn(path, `could not read "${plain(text)}"`);
      return;
    }
    assign(value);
  };

  read(
    "groundTones",
    "ground tones",
    (text) => {
      const found = hexes(text);
      return found.length === 5
        ? (found as SceneThemeTokens["groundTones"])
        : undefined;
    },
    (value) => {
      result.groundTones = value;
    }
  );
  read(
    "glassFill",
    "glass fill",
    (text) => {
      const match = plain(text).match(/^(#[0-9a-f]{6}) at (\d+(?:\.\d+)?)%$/i);
      return match?.[1] && match[2]
        ? { color: match[1], opacity: Number(match[2]) / 100 }
        : undefined;
    },
    (value) => {
      result.glassFill = value;
    }
  );
  for (const [token, key] of Object.entries(SCENE_COLOURS)) {
    read(key, token, singleHex, (value) => {
      result[key] = value;
    });
  }
  return result;
}

/** The text of the bullet that opens with `**Badges**`, backticks removed. */
function badgesBullet(markdown: string): string | undefined {
  const line = markdown
    .split(/\r?\n/)
    .find((entry) => /^\s*[-*]\s+\*\*Badges\*\*/i.test(entry));
  return line === undefined ? undefined : plain(line);
}

function parseBadges(
  fallback: BadgeTokens,
  markdown: string,
  warn: Warn
): BadgeTokens {
  const text = badgesBullet(markdown);
  if (text === undefined) {
    warn("badges", 'no "Badges" bullet');
    return fallback;
  }
  const found = <T>(path: string, value: T | undefined, otherwise: T): T => {
    if (value === undefined) {
      warn(`badges.${path}`, "not found in the Badges bullet");
      return otherwise;
    }
    return value;
  };
  const hexAfter = (pattern: string) =>
    text.match(new RegExp(`${pattern}\\s*(#[0-9a-f]{6})\\b`, "i"))?.[1];
  const percent = numberIn(text, /(\d+(?:\.\d+)?)% fill/);

  const colors = { ...fallback.colors };
  for (const status of Object.keys(colors) as (keyof typeof colors)[]) {
    colors[status] = found(
      `colors.${status}`,
      hexAfter(`\\b${status}`),
      colors[status]
    );
  }
  return {
    heightPx: found(
      "heightPx",
      numberIn(text, /(\d+)px tall/),
      fallback.heightPx
    ),
    dotPx: found("dotPx", numberIn(text, /(\d+)px dot/), fallback.dotPx),
    fillOpacity: found(
      "fillOpacity",
      percent === undefined ? undefined : percent / 100,
      fallback.fillOpacity
    ),
    colors,
    neutral: {
      fill: found(
        "neutral.fill",
        hexAfter("neutral badge is"),
        fallback.neutral.fill
      ),
      border: found(
        "neutral.border",
        text.match(/(#[0-9a-f]{6}) border/i)?.[1],
        fallback.neutral.border
      ),
    },
  };
}

/**
 * Parse both guideline files into `DesignTokens`. Never throws: anything it
 * cannot read comes from `defaults`, with a warning naming the value.
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

  const rolesTable = findTable(tables, ["Role", "Use", "Curve", "Duration"]);
  if (!rolesTable) {
    warn("roles", "no table headed Role / Use / Curve / Duration");
  }
  const roles = defaults.roles.map((fallback) =>
    rolesTable
      ? parseRole(fallback, rowFor(rolesTable, "role", fallback.role), warn)
      : fallback
  );

  const springsTable = findTable(tables, ["Spring", "Use", "Motion config"]);
  if (!springsTable) {
    warn("springs", "no table headed Spring / Use / Motion config");
  }
  const springs = defaults.springs.map((fallback) =>
    springsTable
      ? parseSpring(
          fallback,
          rowFor(springsTable, "spring", fallback.name),
          warn
        )
      : fallback
  );

  const sceneTable = findTable(tables, ["Token", "Light", "Dark"]);
  if (!sceneTable) {
    warn("scene", "no table headed Token / Light / Dark");
  }
  const scene = sceneTable
    ? {
        light: parseSceneTheme("light", defaults.scene.light, sceneTable, warn),
        dark: parseSceneTheme("dark", defaults.scene.dark, sceneTable, warn),
      }
    : defaults.scene;

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

const sceneThemeFields = (theme: SceneThemeTokens) => ({
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
 * The `designTokens` singleton as `pnpm tokens:sync` writes it, in the field
 * shape of `apps/studio/schemaTypes/documents/design-tokens.ts`. Array keys
 * are the role and spring names, so reruns write identical keys.
 */
export function toDesignTokensDocument(
  tokens: DesignTokens,
  raw: DesignTokensRaw
) {
  const { badges, windowChrome } = tokens;
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
    tide: { ...tokens.tide },
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
