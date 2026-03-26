# nosocial-crewai

NoSocial reputation reporting for [CrewAI](https://crewai.com). One import, one line of config — your agents start building reputation automatically.

## Install

```bash
pip install nosocial-crewai
```

## Usage

```python
from crewai import Agent, Task, Crew
from nosocial_crewai import NoSocialReporter

# One line: create a reporter pointing at your oracle
reporter = NoSocialReporter(oracle_url="https://api.nosocial.me")

# Build your crew as normal
researcher = Agent(role="researcher", goal="Find information", backstory="...")
writer = Agent(role="writer", goal="Write reports", backstory="...")

research_task = Task(description="Research AI trends", agent=researcher, expected_output="...")
write_task = Task(description="Write summary", agent=writer, expected_output="...")

# One line: attach the reporter as a task_callback
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, write_task],
    task_callback=reporter.task_callback,  # <-- this is it
)

crew.kickoff()
# After each task completes, an interaction report is automatically
# submitted to the NoSocial oracle. Your agents build reputation.
```

## What it does

When a CrewAI task completes, the reporter:

1. Creates a persistent Ed25519 identity for each agent (stored in `.nosocial/keys/`)
2. Registers agents with the NoSocial oracle (auto-registration on first run)
3. Submits a signed interaction report with:
   - **Domain:** `task_completion` and `reliability`
   - **Score:** `0.8` for successful output, `-0.5` for empty output
   - **Context:** task description, agent role

## Configuration

```python
reporter = NoSocialReporter(
    oracle_url="http://localhost:3000",  # Oracle endpoint
    keys_dir=".nosocial/keys",          # Where to store agent keypairs
    crew_name="my-crew",                # Name for the crew's own identity
    auto_register=True,                 # Auto-register agents with oracle
)
```

## How identity works

Each agent gets a persistent Ed25519 keypair stored as a PEM file. The agent's NoSocial DID is derived from its public key: `did:nosocial:{sha256(publicKey)}`. Keys persist across runs — the same agent always has the same DID.

## License

MIT
