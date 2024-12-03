# Rancher UI Extensions

This repository contains experimental, proof-of-concept UI Extensions for Rancher.

As of now, this is just the Virtual Clusters UI Extension demo.

## Virtual Clusters UI Extension

This extension illustrates integration of the open-source vCluster virtual cluster project into Rancher.

Note: This extension relies on some PoC changes to Rancher that add a couple of additional extension points that are required (see: https://github.com/rancher/dashboard/pull/11064)

With the extension installed, a new option appears on the cluster creation screen allowing you to create a virtual cluster.

Code for this extension is in the `pkg/virtualcluster` folder.

### How this works

This demo does not require any backend changes or components.

When the user creates a virtual cluster in the UI, the UI will:

- Create an imported cluster and obtain the token required to complete the registration of the virtual cluster for the imported cluster
- Make an API request to the downstream cluster to import the YAML resources that will create the vCluster (see `pkg/virtualcluster/resources/vcluster.yaml.md`)
- Make an API request to the downstream cluster to import the YAML resources that will create a job that will complete the cluster registration in Rancher using the token (see `pkg/virtualcluster/resources/import-job.yaml.md`)

The Import Job uses the `rancher/shell` image to run a kubectl shell, running the script mounted from a config map and kubeconfig file mounted from a secret that vCluster will create on cluster creation.

When the user deletes a virtual cluster from the UI, an additional hook will delete the namespace from the downstream cluster to clean up the virtual cluster, in addition to deleting the imported cluster from Rancher.

### Annotations

The UI adds the following annotations to the imported cluster resource that is created:

- `ui.rancher/provider` - set to `vcluster` to indicate that the cluster is a virtual cluster
- `ui.rancher/parent-cluster` - set to the cluster id of the parent cluster (used to group virtual clusters by parent cluster)
- `ui.rancher/vcluster-namespace` - set to the namespace where the virtual cluster was created (used when deleting the cluster)
