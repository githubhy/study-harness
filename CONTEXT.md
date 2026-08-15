# Harness Study

Notes and instruments for understanding agent harnesses as a category, using the DeepSeek Harness (`dsh`) as the specimen. This is a study workspace, not a product.

## Language

**Agent harness**:
The scaffolding around a language model that supplies what the model itself has none of — a control loop, a tool registry, assembled context, and a permission boundary. The unit of study in this repo.
_Avoid_: Agent framework, agent runtime, agent scaffold

**Eval harness**:
An explicitly **excluded** sense of "harness" — a benchmark runner that scores a model against a fixed task set (e.g. `lm-evaluation-harness`). Recorded here only so the two senses never drift together. Nothing in this repo studies eval harnesses.

**Subject**:
The category itself — agent harnesses in general. What this repo is ultimately about.

**Specimen**:
The particular harness being dissected to learn about the subject. Currently `dsh`. A finding about the specimen matters only insofar as it generalises to the subject.
