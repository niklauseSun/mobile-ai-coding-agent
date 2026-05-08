# Architecture

## Summary

The MVP is a no-backend mobile AI coding agent. The mobile app directly coordinates with GitHub APIs, an AI provider API, and GitHub Actions workflows installed in or dispatched against the selected repository.

GitHub is the first supported Git provider, but the domain model should avoid GitHub-only names where a neutral name works. The main abstraction is a `GitProvider` with repositories, change requests, reviews, merge operations, and automation runs.

## Goals

- Let users create and modify code from a mobile device.
- Keep execution inside trusted repository automation, not a product-owned backend.
- Support PR review and merge workflows from mobile.
- Resolve merge conflicts through GitHub Actions.
- Preserve a path to Gitee and GitLab by keeping provider-specific behavior isolated.

## Non-Goals

- Running arbitrary code on product-owned infrastructure.
- Storing user repositories on product-owned servers.
- Maintaining a product backend, job queue, or database in the MVP.
- Supporting GitLab or Gitee in the first release.

## Logical Architecture

```mermaid
flowchart TB
  subgraph Device["Mobile Device"]
    App["Mobile App"]
    SecureStore["Secure Token Storage"]
    LocalState["Local App State"]
  end

  subgraph Providers["External Providers"]
    GitAPI["Git Provider API\nGitHub REST/GraphQL MVP"]
    AIAPI["AI Provider API"]
  end

  subgraph Repository["User Repository"]
    Code["Source Code"]
    Workflow["Automation Workflow\nGitHub Actions MVP"]
    Branch["Agent Branch"]
    CR["Change Request\nGitHub Pull Request MVP"]
  end

  App --> SecureStore
  App --> LocalState
  App --> GitAPI
  App --> AIAPI
  GitAPI --> Code
  GitAPI --> Branch
  GitAPI --> CR
  Workflow --> Code
  Workflow --> Branch
  Workflow --> CR
  Workflow --> AIAPI
```

## Main Components

| Component | Responsibility |
| --- | --- |
| Mobile App | User experience, authentication, repository browsing, prompt capture, AI request orchestration, review UI, merge UI |
| Secure Token Storage | Stores user-granted Git provider tokens and user-provided AI provider credentials when required |
| Git Provider Adapter | Provider-neutral interface over repositories, branches, diffs, change requests, reviews, merges, and workflow dispatch |
| GitHub Adapter | MVP implementation of the Git provider adapter using GitHub APIs |
| Mock Git Adapter | Local development implementation with in-memory repositories, issues, PR/MR data, diffs, workflow runs, merge success, and conflict failure paths |
| AI Provider Adapter | Provider-neutral interface over code generation and code modification requests |
| GitHub Actions Workflow | Repository-hosted execution runner for edits that need checkout, tests, commits, or conflict resolution |

## Provider Abstraction

```mermaid
classDiagram
  class GitProvider {
    connect()
    listRepositories()
    createRepository()
    getRepository()
    createBranch()
    createChangeRequest()
    getChangeRequestDiff()
    submitReview()
    mergeChangeRequest()
    dispatchAutomationRun()
  }

  class GitHubProvider {
    REST API
    GraphQL API
    Actions workflow_dispatch
  }

  class MockGitProvider {
    In-memory development data
  }

  class GitLabProvider {
    Future
  }

  class GiteeProvider {
    Future
  }

  GitProvider <|.. GitHubProvider
  GitProvider <|.. MockGitProvider
  GitProvider <|.. GitLabProvider
  GitProvider <|.. GiteeProvider
```

## Code Generation Flow

```mermaid
sequenceDiagram
  actor User
  participant App as Mobile App
  participant Git as GitHub API
  participant AI as AI Provider API
  participant Actions as GitHub Actions
  participant Repo as Repository

  User->>App: Select repository and describe change
  App->>Git: Read repository metadata and target branch
  App->>AI: Request plan or patch proposal
  AI-->>App: Return proposed change
  App->>Git: Create agent branch
  App->>Git: Commit simple generated files, or dispatch workflow
  App->>Actions: workflow_dispatch for repository checkout/edit/test
  Actions->>AI: Request code edits if runner context is needed
  Actions->>Repo: Commit generated changes to agent branch
  App->>Git: Create pull request
  Git-->>App: PR URL, status, checks, diff
```

## Review and Merge Flow

```mermaid
sequenceDiagram
  actor User
  participant App as Mobile App
  participant Git as GitHub API
  participant Repo as Repository

  User->>App: Open change request
  App->>Git: Fetch files, diff, comments, checks
  Git-->>App: Review data
  User->>App: Approve or request changes
  App->>Git: Submit review decision
  User->>App: Merge
  App->>Git: Verify checks and mergeability
  App->>Git: Merge pull request
  Git->>Repo: Update base branch
```

## Conflict Resolution Flow

```mermaid
sequenceDiagram
  actor User
  participant App as Mobile App
  participant Git as GitHub API
  participant Actions as GitHub Actions
  participant AI as AI Provider API
  participant Repo as Repository

  App->>Git: Detect merge conflict or non-mergeable PR
  User->>App: Request AI conflict resolution
  App->>Actions: Dispatch conflict resolution workflow
  Actions->>Repo: Checkout base and agent branch
  Actions->>Repo: Attempt merge or rebase
  Actions->>AI: Ask for conflict resolution patch
  Actions->>Repo: Apply patch, run checks, commit result
  Actions-->>Git: Update PR branch and checks
  App->>Git: Poll automation run and PR status
```

## Data Boundaries

| Data | Location | Notes |
| --- | --- | --- |
| Git provider access token | Mobile secure storage | Minimum scopes, revocable by user |
| AI provider key | Mobile secure storage or repository secret | Depends on selected provider and workflow mode |
| Repository contents | Git provider and runner workspace | Not stored by product backend |
| Prompts and AI outputs | Mobile local state and runner logs | Must be minimized and redacted |
| PR/MR review data | Git provider | Fetched on demand by mobile app |

## Key Design Decisions

- The MVP avoids a product backend to reduce operational scope and data custody.
- GitHub Actions is the execution runner for tasks that require a working tree, tests, commits, or conflict resolution.
- Mobile app calls GitHub directly for repository and review operations.
- The Mock Git adapter is a developer-only local data source so all main screens can be exercised without a real GitHub token.
- Provider-specific terms stay near adapter implementations; product screens and domain models use neutral naming where possible.
