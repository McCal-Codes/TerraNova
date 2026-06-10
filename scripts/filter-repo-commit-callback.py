# git-filter-repo --commit-callback file (function body only).
# Preserves known human contributors; rewrites unknown / agent identities to McCal.

MCCAL_NAME = b"McCal"
MCCAL_EMAIL = b"business@mcc-cal.com"

ALLOWED_EMAILS = {
    MCCAL_EMAIL,
    b"nmang004@gmail.com",
    b"scrubc1ty4ever@gmail.com",
    b"leo.v.rentmeister@gmail.com",
    b"derrickmehaffy@gmail.com",
    b"ZenithDevHQ@users.noreply.github.com",
}

AGENT_NEEDLES = (
    b"cursor",
    b"copilot",
    b"openai",
    b"anthropic",
    b"dependabot",
    b"github-actions",
    b"agent@",
    b" bots ",
    b"bot@",
)


def _looks_like_agent(name, email):
    blob = name.lower() + b" " + email.lower()
    return any(needle in blob for needle in AGENT_NEEDLES)


def _should_rewrite(name, email):
    if email in ALLOWED_EMAILS and not _looks_like_agent(name, email):
        return False
    return True


if _should_rewrite(commit.author_name, commit.author_email):
    commit.author_name = MCCAL_NAME
    commit.author_email = MCCAL_EMAIL

if _should_rewrite(commit.committer_name, commit.committer_email):
    commit.committer_name = MCCAL_NAME
    commit.committer_email = MCCAL_EMAIL
