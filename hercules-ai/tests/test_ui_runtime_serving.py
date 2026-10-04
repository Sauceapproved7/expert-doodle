from pathlib import Path

def test_api_serves_command_center_root():
    source=Path("hercules-ai/app/main.py").read_text()
    assert 'FileResponse' in source
    assert '@app.get("/",include_in_schema=False)' in source
    assert 'ui/index.html' in source
