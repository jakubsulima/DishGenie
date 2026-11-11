#!/usr/bin/env python3
"""CLI entry point for the same importer bundled with the backend."""
from pathlib import Path
import runpy

globals().update(runpy.run_path(str(Path(__file__).resolve().parents[2] /
    'backendApi/src/main/resources/offers/import_lidl_leaflet.py'),
    run_name='__main__' if __name__ == '__main__' else 'lidl_leaflet_importer'))
