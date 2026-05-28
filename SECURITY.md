# Security Policy

## Scope

**Archive of Experiments** is a static, client-side single-page application. It has
no backend, no database, and no user accounts — every experiment runs entirely in
the visitor's browser. As a result the attack surface is limited to:

- Client-side code (React/TypeScript) and the assets served with it.
- Third-party dependencies pulled in at build time (see `package.json`).

There is no server-side processing, authentication, or persisted user data to
compromise.

## Supported Versions

This project is an evolving archive with no formal release versioning. Only the
latest commit on the `main` branch is maintained and receives security fixes.

| Version            | Supported          |
| ------------------ | ------------------ |
| `main` (latest)    | :white_check_mark: |
| Older commits/tags | :x:                |

## Reporting a Vulnerability

If you discover a security issue, please report it privately rather than opening a
public issue:

- **Email:** baoloc7401@gmail.com
- Alternatively, use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
  ("Report a vulnerability" under the repository's **Security** tab).

Please include:

- A description of the issue and its potential impact.
- Steps to reproduce (affected experiment/page, browser, and any relevant input).
- A proof of concept, if available.

### What to expect

- An acknowledgement of your report within **5 business days**.
- An assessment and, where applicable, a fix merged to `main` as soon as
  practical.
- Credit for the disclosure if you would like it.

Because this is a personal, non-commercial project, there is no bug-bounty program
or monetary reward.

## Dependencies

Dependency vulnerabilities are tracked with `npm audit`. If you spot an advisory
affecting a package listed in `package.json`, a report is welcome but a pull
request bumping the affected dependency is even more so.
