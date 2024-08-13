apiVersion: v1
kind: ConfigMap
metadata:
  namespace: vnamespace
  name: cluster-import-script
data:
  import.sh: |-
    echo "Virtual Cluster Import Job"
    ADDR="${VCLUSTER_PORT_10250_TCP_ADDR}:10250"
    echo $ADDR
    cp  /kubeconfig/config /tmp/kubeconfig.yaml
    sed -i -e s/localhost:8443/${ADDR}/g /tmp/kubeconfig.yaml
    cat /tmp/kubeconfig.yaml
    export KUBECONFIG=/tmp/kubeconfig.yaml
    echo ${RANCHER_IMPORT_URL}
    echo "Waiting for k8s to be ready"
    kubectl get po -A
    while [ $? -ne 0 ]; do
      sleep 5
      kubectl get po -A
    done
    echo "Importing Virtual Cluster ..."
    curl --insecure -sfL ${RANCHER_IMPORT_URL} | kubectl apply -f -
    echo "All Done"
---
apiVersion: batch/v1
kind: Job
metadata:
  namespace: vnamespace
  name: import-virtual-cluster
spec:
  template:
    spec:
      containers:
      - name: import
        image: rancher/shell:v0.1.23
        command: ["sh", "/scripts/import.sh"]
        env:
          - name: RANCHER_IMPORT_URL
            value: "__url"
        volumeMounts:
          - mountPath: "/scripts"
            name: scripts
            readOnly: true
          - mountPath: "/kubeconfig"
            name: kubeconfig
            readOnly: true
      restartPolicy: Never
      volumes:
        - name: scripts
          configMap:
            name: cluster-import-script
        - name: kubeconfig
          secret:
            secretName: vc-vcluster
  backoffLimit: 4
