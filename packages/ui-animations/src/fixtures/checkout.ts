import type { SceneSpec } from "../scene-spec";

/**
 * Hand-written reference scene for the prompt "Show our checkout flow, and
 * adding discounts to cart". Valid against `validateScene` with
 * `DEFAULT_TOKENS`; use it in tests, Storybook-style previews and as a
 * worked example in the Agent Actions instruction.
 */
export const checkoutScene: SceneSpec = {
  sceneMode: "intro",
  theme: "light",
  canvas: { size: 640 },
  label:
    "A shopper applies a 10% discount code in their cart, the total drops from $150 to $135, and the payment is marked paid.",
  windows: [
    {
      _key: "w-cart",
      id: "cart",
      title: "shop.example.com/cart",
      kind: "browser",
      x: 48,
      y: 64,
      w: 360,
      h: 400,
      active: true,
      elements: [
        {
          _key: "e-headphones",
          id: "item-headphones",
          kind: "row",
          label: "Wireless headphones",
          value: "$120",
        },
        {
          _key: "e-case",
          id: "item-case",
          kind: "row",
          label: "Charging case",
          value: "$30",
        },
        {
          _key: "e-discount",
          id: "row-discount",
          kind: "row",
          label: "Discount",
          value: "−$15",
          badge: { status: "success", label: "SPRING10" },
        },
        {
          _key: "e-total",
          id: "row-total",
          kind: "card",
          label: "Total",
          value: "$150",
        },
        {
          _key: "e-apply",
          id: "btn-apply",
          kind: "button",
          label: "Apply discount",
          accent: true,
        },
        {
          _key: "e-pay",
          id: "btn-pay",
          kind: "button",
          label: "Pay now",
        },
      ],
    },
    {
      _key: "w-payments",
      id: "payments",
      title: "Payments",
      kind: "app",
      x: 300,
      y: 320,
      w: 300,
      h: 240,
      active: false,
      elements: [
        {
          _key: "e-order",
          id: "row-order",
          kind: "card",
          label: "Order #1042",
          value: "$135",
          badge: { status: "info", label: "Pending" },
        },
      ],
    },
  ],
  connectors: [
    {
      _key: "c-pay",
      id: "conn-pay",
      from: { windowId: "cart", elementId: "row-total" },
      to: { windowId: "payments", elementId: "row-order" },
      dots: true,
    },
  ],
  cursor: {
    start: { x: 560, y: 120 },
    targets: [
      {
        _key: "t-apply",
        id: "target-apply",
        windowId: "cart",
        elementId: "btn-apply",
        click: true,
      },
      {
        _key: "t-pay",
        id: "target-pay",
        windowId: "cart",
        elementId: "btn-pay",
        click: true,
      },
    ],
  },
  steps: [
    {
      _key: "s1",
      action: "enter",
      target: "cart",
      role: "enter",
      delayMs: 0,
      durationMs: 240,
    },
    {
      _key: "s2",
      action: "move",
      target: "target-apply",
      role: "glide",
      delayMs: 300,
    },
    {
      _key: "s3",
      action: "click",
      target: "target-apply",
      role: "press",
      delayMs: 0,
    },
    {
      _key: "s4",
      action: "reveal",
      target: "row-discount",
      role: "reveal",
      delayMs: 0,
    },
    {
      _key: "s5",
      action: "update",
      target: "row-total",
      role: "enter",
      delayMs: 50,
      value: "$135",
    },
    {
      _key: "s6",
      action: "move",
      target: "target-pay",
      role: "glide",
      delayMs: 400,
    },
    {
      _key: "s7",
      action: "click",
      target: "target-pay",
      role: "press",
      delayMs: 0,
    },
    {
      _key: "s8",
      action: "enter",
      target: "payments",
      role: "enter",
      delayMs: 0,
      durationMs: 240,
    },
    {
      _key: "s9",
      action: "enter",
      target: "conn-pay",
      role: "sweep",
      delayMs: 100,
      durationMs: 900,
    },
    {
      _key: "s10",
      action: "update",
      target: "row-order",
      role: "enter",
      delayMs: 0,
      badge: { status: "success", label: "Paid" },
    },
  ],
};
