# Code signing policy

Windows installers of Atrapo are signed with a certificate issued to the **SignPath Foundation**.
Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## What is signed

Only the installers produced by this repository's GitHub Actions workflow ([`build.yml`](.github/workflows/build.yml)) from the source code in this repository. Nothing is built or signed on a developer's computer.

## Roles

- **Author, reviewer and approver:** the repository owner. Every release is a tagged commit on the `main` branch, and a signing request is approved by the owner after the build finishes.

## Privacy

See [PRIVACY.md](PRIVACY.md). Atrapo collects no data.
