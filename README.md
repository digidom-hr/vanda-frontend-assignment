# Frontend Take-Home Assignment

## Overview

You're joining a team that builds tools for analysts who work with large collections of timeseries. This assignment asks you to build the core of one: a **multi-page chart dashboard** on top of three data services.

We care less about how much you build than about how you decide to build it. Be deliberate. We'll ask you why.

## The brief

Build a dashboard with **one page (route) per data service**. Each page presents its service's data through **multiple chart panels**.

Analysts must be able to:

- use a **global search**, available everywhere in the app, that finds series across all three services at once
- see the results from all services together in a single list, ordered the way an analyst would expect
- select a result and land on the corresponding service's page, with that series in view
- apply transformations to any series, such as rolling sum, moving average, percent change, cumulative and z-score

Beyond that, you decide:

- which data to chart, and which chart type suits each dataset
- how each page is laid out, and how the user moves between them
- which other controls and interactions an analyst would reasonably expect
- how the app behaves when the data is large, slow, or unavailable

Assume the three services are the first of several. Product will keep adding more.

## Data

A local mock API is provided in `/mock-api`. Start it with `npm run api`.

| Service | Endpoints |
|---|---|
| `alpha` | `GET /alpha/series`, `GET /alpha/timeseries` |
| `bravo` | `GET /bravo/series`, `GET /bravo/timeseries` |
| `charlie` | `GET /charlie/series`, `GET /charlie/timeseries`, `GET /charlie/latest` |

The data is synthetic. A short reference is in `/mock-api/API.md`. The datasets vary in size, frequency and scale. What that means for your design is up to you.

## Constraints

- Use any language, framework and libraries you like. Be prepared to justify your choices.
- `npm start` (or one equivalent command) must run everything, including the API.
- Write this as production code your team will own, extend and be paged about, not as a demo.
- Don't change the mock API's data or behaviour.

## How we'll review it

We look at the whole of the work, not only whether it runs. Expect us to consider:

- Architecture and extensibility
- Performance and scalability
- Reliability and resilience
- Accessibility
- Maintainability and code quality
- Testing and correctness
- State management
- User experience and usability

## Submission

- A Git repository or a zip of your project.
- Run instructions, if `npm start` isn't enough.
- Anything else you think we should know before reviewing.
