from app.mcp_server import list_tools


def test_all_mcp_tools_advertise_safe_annotations():
    for tool in list_tools():
        annotations = tool["annotations"]
        assert annotations["readOnlyHint"] is True
        assert annotations["openWorldHint"] is False
        assert annotations["destructiveHint"] is False
        assert annotations["title"]
