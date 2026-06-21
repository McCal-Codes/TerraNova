# git-filter-repo --commit-callback file (function body only).
# Preserves known human contributors; rewrites unlisted identities to McCal-Codes.

MCCAL_NAME = b"McCal-Codes"
MCCAL_EMAIL = b"business@mcc-cal.com"

ALLOWED_EMAILS = {
    MCCAL_EMAIL,
    b"175259256+McCal-Codes@users.noreply.github.com",
    b"McCal-Codes@users.noreply.github.com",
    b"nmang004@gmail.com",
    b"scrubc1ty4ever@gmail.com",
    b"leo.v.rentmeister@gmail.com",
    b"derrickmehaffy@gmail.com",
    b"ZenithDevHQ@users.noreply.github.com",
}

BLOCKED_NEEDLES = (
    b"cursor",
    b"cursoragent",
    b"copilot",
    b"openai",
    b"anthropic",
    b"dependabot",
    b"github-actions",
    b"agent@",
    b" bots ",
    b"bot@",
)


BLOCKED_MESSAGE_SUBSTRINGS = (
    b"claude.ai",
    b"cursoragent",
    b"cursor.com",
    b"anthropic.com",
    b"openai.com",
    b"copilot",
)


def _looks_blocked(name, email):
    blob = name.lower() + b" " + email.lower()
    return any(needle in blob for needle in BLOCKED_NEEDLES)


def _should_rewrite(name, email):
    if email in ALLOWED_EMAILS and not _looks_blocked(name, email):
        return False
    return True


if _should_rewrite(commit.author_name, commit.author_email):
    commit.author_name = MCCAL_NAME
    commit.author_email = MCCAL_EMAIL

if _should_rewrite(commit.committer_name, commit.committer_email):
    commit.committer_name = MCCAL_NAME
    commit.committer_email = MCCAL_EMAIL

# Strip co-author trailers and scrub blocked URL lines from commit messages.
if commit.message:
    lines = commit.message.split(b"\n")
    kept = []
    for line in lines:
        stripped = line.strip().lower()
        if stripped.startswith(b"co-authored-by:"):
            continue
        if any(needle in stripped for needle in BLOCKED_MESSAGE_SUBSTRINGS):
            continue
        kept.append(line)
    message = b"\n".join(kept).strip()
    replacements = (
        (b"feat: ship v0.1.8-alpha.4 closed alpha with QoL milestone and gap audit fixes.", b"feat: ship v0.1.8-alpha.4 closed alpha with QoL milestone"),
        (b"docs: remove AI transparency changelog entry", b"docs: remove obsolete changelog entry"),
        (b"chore: stop tracking local AI and planning artifacts.", b"chore: stop tracking local planning artifacts."),
        (b"docs: add security disclaimer to transparency doc", b"docs: add security disclaimer"),
        (b"docs: add AI transparency disclaimer", b"docs: add project disclaimer"),
    )
    for old, new in replacements:
        message = message.replace(old, new)
    commit.message = message + (b"\n" if message else b"")
