# Agent Configuration

## Skills

### Wiener Linien

Vienna public transport real-time data skill published to ClawdHub.

**Slug:** `wienerlinien`

#### Update from ClawdHub

```bash
clawdhub update wienerlinien --dir ~/.codex/skills
```

#### Publish new version

```bash
clawdhub publish ~/.codex/skills/wienerlinien \
  --slug wienerlinien \
  --name "Wiener Linien" \
  --version <NEW_VERSION> \
  --changelog "<DESCRIPTION OF CHANGES>" \
  --tags "latest,vienna,transit,austria"
```
