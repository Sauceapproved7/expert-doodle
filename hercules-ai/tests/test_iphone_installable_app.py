from pathlib import Path


def test_hercules_ui_is_installable_as_standalone_iphone_app():
    ui = Path("hercules-ai/ui/index.html").read_text()
    main = Path("hercules-ai/app/main.py").read_text()
    manifest = Path("hercules-ai/ui/manifest.webmanifest").read_text()
    sw = Path("hercules-ai/ui/service-worker.js").read_text()

    assert 'rel="manifest" href="/manifest.webmanifest"' in ui
    assert 'apple-mobile-web-app-capable' in ui
    assert 'apple-mobile-web-app-title' in ui
    assert 'apple-touch-icon' in ui
    assert 'navigator.serviceWorker.register("/service-worker.js")' in ui
    assert '"display": "standalone"' in manifest
    assert '"start_url": "/"' in manifest
    assert '"name": "Hercules"' in manifest
    assert '@app.get("/manifest.webmanifest"' in main
    assert '@app.get("/service-worker.js"' in main
    assert '@app.get("/app-icon-192.png"' in main
    assert '@app.get("/app-icon-512.png"' in main
    assert "self.addEventListener(\"fetch\"" in sw
