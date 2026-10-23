# Security policy

## Reporting a vulnerability

Do not open a public issue for a security problem.

Report it privately through
[GitHub private vulnerability reporting](https://github.com/robotostudio/sanity-ui-animations/security/advisories/new),
or email <hrithik@robotostudio.com>. Include the steps to reproduce, the
affected version or commit, and the impact you expect.

## Supported versions

Only the latest commit on `main` receives security fixes. There are no
versioned releases.

## Scope

Reports we are especially interested in:

- Model output, a scene or a prompt that leads to script execution, HTML
  injection, or a network request from the Studio or the website.
- Code compiled into `reactCode` escaping the sandboxed preview iframe.
- Tokens or other secrets exposed to the browser, logs or Agent Actions
  instructions.
- A way to trigger Agent Actions calls, and so spend AI credits, without an
  explicit Generate action.

Problems in Sanity, Next.js or other dependencies should be reported to those
projects directly.
