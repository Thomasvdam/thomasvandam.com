# Hello There

Don't mind me, I'm just trying things out.

## Dependency security

This project configures Bun's install-time security scanner with Socket's
official `@socketsecurity/bun-security-scanner` package. The scanner runs in
free mode without an API key; set `SOCKET_API_KEY` only when Socket
organization policy checks are needed.

Run the scanner against the lockfile with:

```sh
bun pm scan
```

Bun also filters new dependency resolutions to package versions at least seven
days old (`minimumReleaseAge = 604800`). The repository intentionally has no
age-gate exclusions, and existing versions already recorded in `bun.lock` are
not changed by the age filter. See the [Bun security scanner
documentation](https://bun.com/docs/pm/security-scanner-api), [Bun install
configuration](https://bun.com/docs/runtime/bunfig), and [Socket's Bun scanner
README](https://github.com/SocketDev/bun-security-scanner) for details.
