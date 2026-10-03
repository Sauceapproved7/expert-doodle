# Dev Container and Podman

This workspace pins its editor-side toolchain in `.devcontainer/devcontainer.json` and `.devcontainer/toolchain-versions.json`. The container provides the project CLIs for OpenShift, Kubernetes, Helm, and Ansible. CI checks those versions through the Dev Container workflow.

## Start the workspace

1. Install VS Code and the **Dev Containers** extension.
2. Install and start a container engine on the host. On Fedora or RHEL, Podman is supported for local development:

   ```sh
   sudo dnf install -y podman podman-compose buildah skopeo
   podman info
   ```

3. In VS Code user settings, set the Dev Containers CLI path to Podman:

   ```json
   {
     "dev.containers.dockerPath": "podman"
   }
   ```

   Keep this setting in your user profile because container engine paths depend on each developer's host. On macOS and Windows, use the Podman machine or Podman Desktop workflow for that host.

4. Open the repository and choose **Dev Containers: Reopen in Container**.
5. Verify the pinned project tools:

   ```sh
   .devcontainer/verify-tools.sh
   ```

The repository's OpenShift manifests are mapped to the Kubernetes schema by `.vscode/settings.json`, so YAML diagnostics and completion are available while editing.

## Connect to an OpenShift cluster

Use the cluster's approved authentication flow from the Dev Container terminal after it starts:

```sh
oc login https://api.<cluster-domain>:6443
oc whoami --show-server
oc project <namespace>
kubectl config current-context
```

Replace the placeholders with values supplied by your cluster administrator. Cluster credentials and kubeconfig files stay outside Git. A configured editor or CLI does not grant cluster access; access still depends on your account and the cluster's RBAC policy.

VS Code is for authoring and inspection. Run the repository's tests and CI validation before merging changes, and use the approved Git or GitOps deployment path for durable changes.
