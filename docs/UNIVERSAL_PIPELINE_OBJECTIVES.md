# Universal Pipeline Objectives

## Product objective

ThinkNet is a **universal visual machine-learning workbench**. Users should be able to build, configure, run, inspect, save, and reuse pipelines for different ML problems without a separate workflow implementation for every task.

Examples include image classification (MNIST), sentiment analysis, loan approval, regression, clustering, recommendation, and later multimodal or generative workflows. These are examples of what the same system should support, not hard-coded task modes.

## Core principles

1. **One pipeline engine, many projects.** Differences belong in data, component configuration, model choice, and graph topology—not separate task-specific engines.
2. **Small component contract.** A component declares its type, input ports, output ports, configuration, validation, and execution. Keep this contract small.
3. **Typed connections.** Ports describe accepted and produced values, such as dataset reference, features, targets, tensor, model, metrics, or artifact. Validate connections before execution.
4. **References for large values.** Pass lightweight references to datasets, tensors, checkpoints, and files. Do not copy entire datasets through graph edges.
5. **X and Y are first-class, not mandatory.** Supervised workflows can extract and transform X (features) and Y (targets), split them consistently, inspect them, and connect them to training/evaluation. Unsupervised, generative, and inference-only workflows can omit Y.
6. **One execution path.** Validate the graph, resolve dependencies, execute components in dependency order, capture status/logs/metrics, and store outputs. Long-running work stays outside the UI thread.
7. **Minimal experience and code.** One project, one canvas, one component library, one configuration surface, and one run/results view. Prefer simple functions and data structures over unnecessary abstractions.
8. **Extensible by design.** Built-in components cover common operations; a documented custom Python component interface lets users add missing operations.

## Universal project workflow

A project contains:

- **Project settings:** name, task description, seed, execution target, and defaults.
- **Pipeline graph:** components, typed connections, and configuration.
- **Data and artifacts:** dataset references, processed data, model files, checkpoints, metrics, and run outputs.
- **Run records:** inputs, component configuration, execution status, logs, metrics, and artifact references needed to inspect and reproduce a run.

The common workflow is:

~~~text
Load data → Inspect / process → Prepare inputs → Build or load model
→ Train (optional) → Evaluate (optional) → Save / export → Predict or deploy
~~~

This is a reusable pattern, not a compulsory fixed sequence. Components may be omitted or rearranged.

## Core component capabilities

| Group | Examples |
| --- | --- |
| Data | Load CSV, images, text, audio; inspect; filter; sample |
| Preparation | Clean, transform, encode, tokenize, normalize, resize |
| Dataset | Split, batch, shuffle, extract features and targets |
| Features | Select, combine, embed, transform |
| Models | Build from the existing architecture graph; import/load a model |
| Training | Loss, optimizer, scheduler, trainer, checkpoint |
| Evaluation | Predict, metrics, validation, test, reports |
| Model operations | Save, load, export, quantize |
| Utility | Custom Python operation; reusable sub-pipeline |

Do not add every possible operation up front. Add components when real workflows need them and they can be tested.

## X and Y requirements

For supervised learning, dataset operations must support:

- Selecting columns/fields or input/label paths as X and Y.
- Inspecting shape, type, missing values, and basic distributions.
- Applying compatible transformations to X and Y.
- Splitting paired X and Y together to prevent row misalignment or data leakage.
- Exposing train, validation, and test outputs with clear metadata.
- Handling classification labels and regression targets without assuming every target is text.

Y is optional. The graph must also support unlabeled datasets, clustering, generation, and inference workflows.

## Component contract

Keep the first version deliberately small. Fit the implementation to the existing backend and graph types rather than introducing a competing graph system.

Conceptual contract:

~~~python
class Component:
    def validate(self, inputs, config):
        ...

    def run(self, inputs, config, context):
        return outputs
~~~

Each component must declare its input/output ports and configuration schema as metadata. Validation should fail with an actionable message before expensive execution. Run returns named outputs and may store large results in the artifact store, returning references.

This is a design target, not a claim that all current nodes already implement it.

## Acceptance criteria

The universal foundation is ready when:

- The same graph format and execution engine run workflows with image, text, and tabular data.
- At least one supervised workflow uses paired X/Y, and a workflow without Y also works.
- A user can replace a dataset or model without changing task-specific backend code.
- Incompatible ports, invalid configurations, missing inputs, and cycles are caught before execution with useful errors.
- Large data moves through stored references rather than repeated graph serialization.
- Runs expose status, logs, metrics, and saved artifacts; a saved project can be reopened.
- A failed component reports its failure without leaving the project in an ambiguous state.
- Tests cover the component contract, graph validation, execution ordering, X/Y alignment, optional Y, and artifact references.

## Delivery order

1. **Foundation:** settle the existing graph and component contracts; typed ports; graph validation; execution lifecycle.
2. **Data foundation:** dataset/artifact references; inspect, transform, split, and X/Y operations.
3. **End-to-end workflows:** demonstrate image, text, and tabular projects using the same engine.
4. **Model lifecycle:** build/import, train, evaluate, save/load, and inference through reusable components.
5. **Extensibility:** custom Python components and reusable sub-pipelines.
6. **Additional runtimes and domains:** remote GPUs, multimodal workflows, and robotics after local execution is dependable.

## Scope and non-goals

- Do not create separate MNIST, sentiment, loan-approval, or other task engines.
- Do not require every project to use X and Y.
- Do not present a catalog node as executable unless it has a real implementation and tests.
- Do not rewrite the desktop framework or existing application architecture as part of this pipeline objective.
- Do not add speculative abstractions, microservices, or a large plugin framework before the core workflow proves the need.

**Guiding principle:** keep the implementation small and the capabilities composable. ThinkNet should be simple to use and simple to maintain, while remaining general enough to express many different ML projects.
