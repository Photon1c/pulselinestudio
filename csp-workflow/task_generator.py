import random

def generate_tasks(num_tasks, min_duration=1, max_duration=8):
    return [random.randint(min_duration, max_duration) for _ in range(num_tasks)]
