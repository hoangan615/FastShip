BEAT_SCHEDULE = {
    "batch-update-shipper-scores": {
        "task": "app.workers.tasks_matching.batch_update_scores",
        "schedule": 20 * 60,  # every 20 minutes (spec: 15-30 min)
    },
    "release-due-escrow": {
        "task": "app.workers.tasks_escrow.release_due_escrow",
        "schedule": 5 * 60,  # every 5 minutes
    },
}
