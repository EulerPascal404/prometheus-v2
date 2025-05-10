# O-1 Visa Application ML Pipeline

This directory contains the machine learning pipeline for generating and processing O-1 visa applications using RL-based data generation techniques and agentic swarms.

## Overview

The ML pipeline consists of several components:

1. **Data Collection & Processing**: Extract and standardize data from O-1 visa applications
2. **Synthetic Data Generation**: Generate realistic synthetic data using rule-based and RL techniques
3. **Agentic Swarms**: Coordinate multiple specialized agents to fill forms optimally
4. **Advanced Agent Architecture**: Enhanced agent swarm with improved collaboration and form quality evaluation

## Integration with validate-documents.py

The ML pipeline now leverages functionality from the `/api/validate-documents.py` module for improved performance and consistency:

- **Enhanced Data Extraction**: Uses the advanced PDF processing functions from validate-documents.py to extract text and structures
- **LLM-powered Analysis**: Leverages OpenAI API integration for more accurate document analysis
- **Improved Form Field Handling**: Uses the standardized form field handling for O-1 and I-129 forms
- **Form Generation**: Uses the write_rag_responses functionality to generate more realistic form data
- **Consistent Field Statistics**: Shares the field statistics calculation logic for better analytics

The integration provides several benefits:
- Eliminates code duplication between ML and API components
- Ensures consistent behavior across the application
- Leverages production-tested functionality
- Provides access to Supabase storage and OpenAI analysis when available

When the validate-documents.py functionality is not available, the ML pipeline gracefully falls back to its original implementation.

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
├── data_extraction.py             # Extract structured data from PDFs (now uses validate-documents.py)
├── setup_data_dirs.py             # Set up data directories
├── collect_and_process.py         # Main data processing pipeline (now uses validate-documents.py)
├── synthetic_data_generator.py    # Base class for synthetic data generation
├── rule_based_generator.py        # Rule-based synthetic data generator
├── rl_based_generator.py          # RL-based synthetic data generator (now uses validate-documents.py)
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
2. **Extract text from PDFs**: Now uses the process_pdf_content function from validate-documents.py
3. **Extract structured data**: Leverages OpenAI API integration when available
4. **Store processed data**: Save as JSON files for further processing

## Synthetic Data Generation

The synthetic data generation pipeline creates realistic data for O-1 visa applications using three approaches:

1. **Rule-based Generation**: Uses predefined rules and templates to generate structured data
2. **RL-based Generation**: Uses reinforcement learning with simple agent swarms, enhanced with validate-documents.py
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
5. **Further Integration**: Complete integration with the production API stack

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

### Using validate-documents.py Integration

```python
from ml.data_extraction import DataExtractor
from ml.rl_based_generator import RLBasedGenerator

# Extract data from a document using enhanced extraction
extractor = DataExtractor()
with open("sample_resume.pdf", "rb") as f:
    file_content = f.read()
result = extractor.process_document(file_content, "resume")
print(f"Extracted {len(result.keys())} fields from resume")

# Generate O-1 form using validate-documents.py integration
generator = RLBasedGenerator()
form_data = generator._generate_o1_form("complex")
print(f"Generated O-1 form with {len(form_data['form_fields'])} fields")
``` 