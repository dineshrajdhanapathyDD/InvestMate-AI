# InvestMate AI: an honest research companion for NSE investors

**Tag:** `agent`

> Understand the market before making your next move.

## What your agent does

InvestMate AI is an investment research companion for Indian retail investors
who are learning how the stock market works. You ask a plain-English question
about an NSE-listed company, for example "Explain what happened to TCS and help
me understand its historical performance," and the agent selects the right data
tool, retrieves the data, and returns an explanation grounded in the numbers it
actually fetched. Alongside the answer it shows which tools ran, the data source
and timestamp, and whether the figures are live or demonstration data.

The target users are beginners and retail investors who want to understand a
price move without reading a dense financial report. The signature feature is
**Beginner Mode** ("Explain It Like I'm New to Investing"), which structures
every answer into three sections: what the data shows, what it might mean, and
what to research next. The agent is deliberately cautious. It separates
confirmed facts from interpretation, never promises profit, and never gives a
guaranteed buy or sell call.

## How I built it

![AWS architecture](screenshots/architecture-aws.png)

The architecture is cost-conscious serverless. A React, TypeScript and Vite
single-page app (Tailwind for styling, Recharts for charts) is hosted on Amazon
S3 behind CloudFront. The browser calls Amazon API Gateway, which invokes a
Python AWS Lambda function. The Lambda is the agent orchestrator: it calls
Amazon Bedrock with the Converse API and a tool configuration, lets the model
decide which tool to use, executes that tool itself against a market-data
provider, and feeds the real results back to the model to compose a grounded
answer. A DynamoDB table stores the watchlist and preferences keyed by an
anonymous client id. The whole stack is defined with AWS SAM, with
least-privilege IAM, API Gateway throttling, and CloudWatch logging.

The model is Amazon Bedrock Nova Lite. Deploying to the Mumbai region
`ap-south-1` surfaced a real lesson: Nova there cannot be invoked on-demand by
its raw model id and requires the cross-region inference profile
`apac.amazon.nova-lite-v1:0`. The IAM policy was scoped to the inference profile
plus the underlying Nova foundation models.

The biggest challenge was the NSE MCP integration itself. The official endpoints
(`cm-market` and `nse-bhavcopy`, transport `streamable-http`, no auth) are
designed for interactive clients like Claude Desktop and ChatGPT. I verified,
with curl, httpx, and the official MCP Python SDK, that they sit behind Akamai
bot management and return a 504 timeout to any headless server. A Lambda cannot
solve the JavaScript challenge, so it cannot reach them directly. Rather than
fake it, I built a real MCP `streamable-http` client with discovery, timeouts,
and retries, and made it fall back to a clearly labelled, deterministic
sample-data provider. The endpoint URLs are configurable, so a browser-session
proxy would switch the app to live data with no code change.

## The experience

Every data surface has a loading skeleton, an empty state, and an error state
with a retry control. Demonstration data is labelled everywhere it appears, and
a freshness indicator shows the source and timestamp. If the AI model or data
layer fails, the app returns a clear message and preserves the user's question
so they can retry without retyping. Historical volatility is only reported when
there are enough observations; otherwise the app explains why it is withholding
the number. I tested these behaviors with 36 automated tests (31 backend, 5
frontend) covering tool selection, invalid symbols, failure handling, the
no-fabrication guarantee, date retention, and sample labelling.

## Proof it works

- Public app: `https://d2x3869ki4yvj9.cloudfront.net`
- API health: `https://yrdnvo6e7c.execute-api.ap-south-1.amazonaws.com/prod/api/v1/health`
- A live `POST /research` for TCS returned a Beginner Mode answer whose every
  number (period return, high, low, volatility, observation count) matched the
  retrieved evidence, with `isSample: true` and source timestamps. The raw
  response was captured during deployment verification.
- CloudFront served the app over HTTPS (200), the API CORS preflight succeeded,
  and the SPA deep-link fallback worked, all confirmed with live requests.
- Repository: see the project README, SAM template, and the 36 automated tests.

Screenshots captured from the live app:

**Dashboard** - market indices, the Reliance historical chart with derived
metrics, and "Demonstration data" labels with timestamps.

![Dashboard](screenshots/dashboard.png)

**Settings and connection health** - the live model (`apac.amazon.nova-lite-v1:0`,
`ap-south-1`) and the honest NSE MCP fallback explanation.

![Connection health](screenshots/connection-health.png)

**AI research panel**

![AI Research](screenshots/research.png)

**Portfolio risk explorer**

![Portfolio](screenshots/portfolio.png)

Architecture diagrams in `docs/`:
- `architecture-aws.drawio` and `screenshots/architecture-aws.png` - AWS format
  with official AWS service icons (CloudFront, S3, API Gateway, Lambda, Bedrock,
  DynamoDB, CloudWatch, IAM).
- `architecture.drawio` - plain editable version.
- `architecture.md` - mermaid render of the same design.

InvestMate AI is for educational use only and is not investment advice.



