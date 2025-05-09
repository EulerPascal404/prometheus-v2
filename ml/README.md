# O-1 Visa Application ML Pipeline

This directory contains the machine learning pipeline for generating and processing O-1 visa applications using RL-based data generation techniques and agentic swarms.

## Overview

The ML pipeline consists of several components:

1. **Data Collection & Processing**: Extract and standardize data from O-1 visa applications
2. **Synthetic Data Generation**: Generate realistic synthetic data using rule-based and RL techniques
3. **Agentic Swarms**: Coordinate multiple specialized agents to fill forms optimally
4. **Advanced Agent Architecture**: Enhanced agent swarm with improved collaboration and form quality evaluation

## Getting Started

### Prerequisites

- Python 3.8+
- PyPDF2
- Required packages in `requirements.txt`

### Setup

1. Initialize the data directory structure:

```bash
python -m ml.setup_data_dirs
```

2. Process existing data files:

```bash
python -m ml.collect_and_process
```

3. Generate synthetic training data:

```bash
python -m ml.generate_synthetic_data --num-samples 20 --complexity medium
```

## Directory Structure

```
ml/
├── __init__.py                    # Package initialization
├── data_extraction.py             # Extract structured data from PDFs
├── setup_data_dirs.py             # Set up data directories
├── collect_and_process.py         # Main data processing pipeline
├── synthetic_data_generator.py    # Base class for synthetic data generation
├── rule_based_generator.py        # Rule-based synthetic data generator
├── rl_based_generator.py          # RL-based synthetic data generator
├── advanced_agent_swarm.py        # Enhanced agent swarm implementation
├── advanced_rl_generator.py       # Advanced RL-based generator
├── generate_synthetic_data.py     # Script to generate synthetic data
├── test_generators.py             # Test script for basic generators
├── test_advanced_generators.py    # Test script for advanced generators
└── README.md                      # This file
```

## Data Processing Pipeline

The data processing pipeline consists of the following steps:

1. **Set up directory structure**: Create directories for raw, processed, and synthetic data
2. **Extract text from PDFs**: Using PyPDF2 to extract text content
3. **Extract structured data**: Use regex and heuristics to identify fields
4. **Store processed data**: Save as JSON files for further processing

## Synthetic Data Generation

The synthetic data generation pipeline creates realistic data for O-1 visa applications using three approaches:

1. **Rule-based Generation**: Uses predefined rules and templates to generate structured data
2. **RL-based Generation**: Uses reinforcement learning with simple agent swarms
3. **Advanced RL-based Generation**: Uses enhanced agent swarms with specialized capabilities

You can generate data using any approach:

```bash
# Generate using rule-based approach
python -m ml.generate_synthetic_data --generator rule --num-samples 10

# Generate using basic RL-based approach
python -m ml.generate_synthetic_data --generator rl --num-samples 10 --train-episodes 100

# Generate using advanced RL-based approach
python -m ml.generate_synthetic_data --generator advanced_rl --num-samples 10 --train-episodes 100

# Generate using all approaches
python -m ml.generate_synthetic_data --generator all --num-samples 10
```

## Agentic Swarms

### Basic Agent Swarm

The basic RL-based generator uses a simple agentic swarm approach where multiple specialized agents collaborate to fill different parts of the form:

- **Personal Information Agent**: Specializes in generating consistent personal details
- **Employment Agent**: Focuses on job-related information
- **Eligibility Agent**: Handles O-1 eligibility criteria sections

### Advanced Agent Swarm

The advanced RL-based generator extends the basic swarm with enhanced capabilities:

- **Form Structure Analysis**: Detailed analysis of form fields and their dependencies
- **Memory Component**: Agents can learn from past experiences and improve over time
- **Specialized Strategies**: Each agent has custom strategies for specific field types
- **Form Quality Evaluation**: Evaluates completeness, consistency, and validity of forms
- **Enhanced Collaboration**: Better coordination between agents through field dependency tracking

## Form Structures

The advanced agent swarm works with detailed form structures that include:

- Field hierarchies and relationships
- Field dependencies (which fields depend on other fields)
- Important fields that require special attention
- Field validation rules and constraints

## Running Tests

To test the basic generators:

```bash
python -m ml.test_generators
```

To test the advanced agent swarm and RL generator:

```bash
python -m ml.test_advanced_generators
```

## Future Development

1. **Neural Network Policies**: Replace the rule-based strategies with trained neural networks
2. **Multi-Agent Reinforcement Learning**: Implement true MARL algorithms for agent training
3. **Cross-form Learning**: Enable knowledge transfer between different form types
4. **Human-in-the-Loop Refinement**: Add capabilities for human feedback to improve agent behavior

## Usage Examples

### Generate Synthetic Form with Advanced RL

```python
from ml.advanced_rl_generator import AdvancedRLGenerator

generator = AdvancedRLGenerator()
generator.train(episodes=100, form_type="o1")
o1_form = generator.generate_synthetic_document("o1", "complex")
print(f"Generated O-1 form with quality score: {o1_form['evaluation']['quality_score']:.2f}")
```

### Create and Evaluate Form using Agent Swarm

```python
from ml.advanced_agent_swarm import FormStructure, EnhancedAgentSwarm, EnhancedRLEnvironment

# Create form structure
form_template = {...}  # Your form template
form_structure = FormStructure(form_template)

# Create environment and agent swarm
env = EnhancedRLEnvironment(form_template)
agent_swarm = EnhancedAgentSwarm(form_structure)

# Fill form
state = env.reset()
done = False
while not done:
    action = agent_swarm.select_action(state)
    if not action["field_name"]:
        break
    next_state, reward, done, _ = env.step(action)
    state = next_state

# Evaluate form
filled_form = env.field_values
evaluation = agent_swarm.evaluate_filled_form(filled_form)
print(f"Form quality score: {evaluation['quality_score']:.2f}")
``` 