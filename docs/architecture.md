# InvestMate AI - Architecture

Request flow: React SPA (CloudFront + S3) to API Gateway to a Python Lambda
agent orchestrator, which calls Amazon Bedrock (Nova Lite) with controlled
tool use and fetches data through a resilient provider. The live NSE MCP path is
verified-unreachable from a headless runtime (Akamai bot protection returns a
504), so the app falls back to clearly labelled sample data. An editable
diagram is in `architecture.drawio`.

```mermaid
flowchart LR
    user([Retail investor<br/>browser])

    subgraph FE["Frontend hosting"]
        cf["Amazon CloudFront<br/>HTTPS, SPA fallback"]
        s3["Amazon S3<br/>private bucket + OAC<br/>React + TS + Vite build"]
    end

    apigw["Amazon API Gateway<br/>REST /api/v1/*<br/>validation + throttling"]

    subgraph L["AWS Lambda (Python 3.13) - agent orchestrator"]
        router["Router + validation<br/>JSON envelope"]
        agent["ResearchAgent<br/>Bedrock Converse tool-use loop"]
        provider["ResilientProvider<br/>live MCP first, labelled fallback"]
        sample["SampleDataProvider<br/>deterministic, is_sample=true"]
    end

    bedrock["Amazon Bedrock<br/>Nova Lite<br/>apac.amazon.nova-lite-v1:0"]
    dynamo[("Amazon DynamoDB<br/>watchlist + prefs")]
    cw["Amazon CloudWatch<br/>logs + metrics"]
    nse["NSE MCP endpoints<br/>streamable-http<br/>BLOCKED by Akamai: 504"]

    user --> cf
    cf --> s3
    cf -->|HTTPS /api/v1 CORS| apigw
    apigw -->|Lambda proxy| router
    router --> agent
    agent <-->|tool_use| bedrock
    agent -->|executes tool| provider
    provider -->|fallback| sample
    provider -. try live 504 .-> nse
    router <-->|watchlist / prefs| dynamo
    agent -->|logs| cw

    classDef blocked fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
    classDef ai fill:#ede9fe,stroke:#6d28d9;
    class nse blocked
    class bedrock ai
```
