#!/usr/bin/env python3
"""Test imports for advanced agent modules."""

import sys
from pathlib import Path

# Add root directory to path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.append(str(ROOT_DIR))

print("Testing imports...")

try:
    from ml.advanced_agent_swarm import FormStructure, EnhancedAgentSwarm, EnhancedRLEnvironment
    print("Successfully imported advanced_agent_swarm")
except Exception as e:
    print(f"Error importing advanced_agent_swarm: {str(e)}")

try:
    from ml.advanced_rl_generator import AdvancedRLGenerator
    print("Successfully imported AdvancedRLGenerator")
except Exception as e:
    print(f"Error importing AdvancedRLGenerator: {str(e)}")

print("Import tests completed") 