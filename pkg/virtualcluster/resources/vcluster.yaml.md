# Source: vcluster/templates/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: vc-vcluster
  namespace: vnamespace
  labels:
    app: vcluster
    chart: "vcluster-0.19.5"
    release: "vcluster"
    heritage: "Helm"
---
# Source: vcluster/templates/workloadserviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: vc-workload-vcluster
  namespace: vnamespace
  labels:
    app: vcluster
    chart: "vcluster-0.19.5"
    release: "vcluster"
    heritage: "Helm"
---
# Source: vcluster/templates/coredns.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: vcluster-coredns
  namespace: vnamespace
data:
  coredns.yaml: |-
    apiVersion: v1
    kind: ServiceAccount
    metadata:
      name: coredns
      namespace: kube-system
    ---
    apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRole
    metadata:
      labels:
        kubernetes.io/bootstrapping: rbac-defaults
      name: system:coredns
    rules:
      - apiGroups:
          - ""
        resources:
          - endpoints
          - services
          - pods
          - namespaces
        verbs:
          - list
          - watch
      - apiGroups:
          - discovery.k8s.io
        resources:
          - endpointslices
        verbs:
          - list
          - watch
    ---
    apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRoleBinding
    metadata:
      annotations:
        rbac.authorization.kubernetes.io/autoupdate: "true"
      labels:
        kubernetes.io/bootstrapping: rbac-defaults
      name: system:coredns
    roleRef:
      apiGroup: rbac.authorization.k8s.io
      kind: ClusterRole
      name: system:coredns
    subjects:
      - kind: ServiceAccount
        name: coredns
        namespace: kube-system
    ---
    apiVersion: v1
    kind: ConfigMap
    metadata:
      name: coredns
      namespace: kube-system
    data:
      Corefile: |-
        .:1053 {
            errors
            health
            ready
            rewrite name regex .*\.nodes\.vcluster\.com kubernetes.default.svc.cluster.local
            kubernetes cluster.local in-addr.arpa ip6.arpa {
                pods insecure
                fallthrough in-addr.arpa ip6.arpa
            }
            hosts /etc/NodeHosts {
                ttl 60
                reload 15s
                fallthrough
            }
            prometheus :9153
            forward . /etc/resolv.conf
            cache 30
            loop
            loadbalance
        }
      
        import /etc/coredns/custom/*.server
      NodeHosts: ""
    ---
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: coredns
      namespace: kube-system
      labels:
        k8s-app: kube-dns
        kubernetes.io/name: "CoreDNS"
    spec:
      replicas: 1
      strategy:
        type: RollingUpdate
        rollingUpdate:
          maxUnavailable: 1
      selector:
        matchLabels:
          k8s-app: kube-dns
      template:
        metadata:
          labels:
            k8s-app: kube-dns
        spec:
          priorityClassName: "system-cluster-critical"
          serviceAccountName: coredns
          nodeSelector:
            kubernetes.io/os: linux
          topologySpreadConstraints:
            - maxSkew: 1
              topologyKey: kubernetes.io/hostname
              whenUnsatisfiable: DoNotSchedule
              labelSelector:
                matchLabels:
                  k8s-app: kube-dns
          containers:
            - name: coredns
              image: {{.IMAGE}}
              imagePullPolicy: IfNotPresent
              resources:
                limits:
                  cpu: 1000m
                  memory: 170Mi
                requests:
                  cpu: 3m
                  memory: 16Mi
              args: [ "-conf", "/etc/coredns/Corefile" ]
              volumeMounts:
                - name: config-volume
                  mountPath: /etc/coredns
                  readOnly: true
                - name: custom-config-volume
                  mountPath: /etc/coredns/custom
                  readOnly: true
              securityContext:
                runAsNonRoot: true
                runAsUser: {{.RUN_AS_USER}}
                runAsGroup: {{.RUN_AS_GROUP}}
                allowPrivilegeEscalation: false
                capabilities:
                  add:
                    - NET_BIND_SERVICE
                  drop:
                    - ALL
                readOnlyRootFilesystem: true
              livenessProbe:
                httpGet:
                  path: /health
                  port: 8080
                  scheme: HTTP
                initialDelaySeconds: 60
                periodSeconds: 10
                timeoutSeconds: 1
                successThreshold: 1
                failureThreshold: 3
              readinessProbe:
                httpGet:
                  path: /ready
                  port: 8181
                  scheme: HTTP
                initialDelaySeconds: 0
                periodSeconds: 2
                timeoutSeconds: 1
                successThreshold: 1
                failureThreshold: 3
          dnsPolicy: Default
          volumes:
            - name: config-volume
              configMap:
                name: coredns
                items:
                  - key: Corefile
                    path: Corefile
                  - key: NodeHosts
                    path: NodeHosts
            - name: custom-config-volume
              configMap:
                name: coredns-custom
                optional: true
    ---
    apiVersion: v1
    kind: Service
    metadata:
      name: kube-dns
      namespace: kube-system
      annotations:
        prometheus.io/port: "9153"
        prometheus.io/scrape: "true"
      labels:
        k8s-app: kube-dns
        kubernetes.io/cluster-service: "true"
        kubernetes.io/name: "CoreDNS"
    spec:
      selector:
        k8s-app: kube-dns
      type: ClusterIP
      ports:
        - name: dns
          port: 53
          targetPort: 1053
          protocol: UDP
        - name: dns-tcp
          port: 53
          targetPort: 1053
          protocol: TCP
        - name: metrics
          port: 9153
          protocol: TCP
---
# Source: vcluster/templates/init-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: vcluster-init-manifests
  namespace: vnamespace
  labels:
    app: vcluster
    chart: "vcluster-0.19.5"
    release: "vcluster"
    heritage: "Helm"
data:
  manifests: |-
    ---
---
# Source: vcluster/templates/rbac/role.yaml
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: vcluster
  namespace: vnamespace
  labels:
    app: vcluster
    chart: "vcluster-0.19.5"
    release: "vcluster"
    heritage: "Helm"
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets", "services", "pods", "pods/attach", "pods/portforward", "pods/exec", "persistentvolumeclaims"]
    verbs: ["create", "delete", "patch", "update", "get", "list", "watch"]
  - apiGroups: [""]
    resources: ["endpoints"]
    verbs: ["create", "delete", "patch", "update"]
  - apiGroups: [""]
    resources: ["endpoints", "events", "pods/log"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["statefulsets", "replicasets", "deployments"]
    verbs: ["get", "list", "watch"]
---
# Source: vcluster/templates/rbac/rolebinding.yaml
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: vcluster
  namespace: vnamespace
  labels:
    app: vcluster
    chart: "vcluster-0.19.5"
    release: "vcluster"
    heritage: "Helm"
subjects:
  - kind: ServiceAccount
    name: vc-vcluster
    namespace: vnamespace
roleRef:
  kind: Role
  name: vcluster
  apiGroup: rbac.authorization.k8s.io
---
# Source: vcluster/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: vcluster
  namespace: vnamespace
  labels:
    app: vcluster
    chart: "vcluster-0.19.5"
    release: "vcluster"
    heritage: "Helm"
spec:
  type: ClusterIP
  ports:
    - name: https
      port: 443
      targetPort: 8443
      nodePort: 
      protocol: TCP
    - name: kubelet
      port: 10250
      targetPort: 8443
      nodePort: 
      protocol: TCP
  selector:
    app: vcluster
    release: vcluster
---
# Source: vcluster/templates/statefulset-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: vcluster-headless
  namespace: vnamespace
  labels:
    app: vcluster
    chart: "vcluster-0.19.5"
    release: "vcluster"
    heritage: "Helm"
spec:
  publishNotReadyAddresses: true
  ports:
    - name: https
      port: 443
      targetPort: 8443
      protocol: TCP
  clusterIP: None
  selector:
    app: vcluster
    release: "vcluster"
---
# Source: vcluster/templates/syncer.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: vcluster
  namespace: vnamespace
  labels:
    app: vcluster
    chart: "vcluster-0.19.5"
    release: "vcluster"
    heritage: "Helm"
spec:
  serviceName: vcluster-headless
  replicas: 1
  selector:
    matchLabels:
      app: vcluster
      release: vcluster
  template:
    metadata:
      labels:
        app: vcluster
        release: vcluster
    spec:
      terminationGracePeriodSeconds: 10
      nodeSelector:
        {}
      tolerations:
        []
      serviceAccountName: vc-vcluster
      volumes:        
        - name: helm-cache
          emptyDir: {}
        - name: binaries
          emptyDir: {}
        - name: tmp
          emptyDir: {}
        - name: config
          emptyDir: {}
        - name: coredns
          configMap:
            name: vcluster-coredns
        - name: custom-config-volume
          configMap:
            name: coredns-custom
            optional: true
        - name: data
          emptyDir: {}
      initContainers:      
      - image: rancher/k3s:K8S_VERSION
        name: vcluster
        # k3s has a problem running as pid 1 and disabled agents on cgroupv2
        # nodes as it will try to evacuate the cgroups there. Starting k3s
        # through a shell makes it non pid 1 and prevents this from happening
        command:
          - /bin/sh
        args:
          - -c
          - "cp /bin/k3s /binaries/k3s"
        securityContext:
          allowPrivilegeEscalation: false
          runAsGroup: 0
          runAsUser: 0
        volumeMounts:
          - name: binaries
            mountPath: /binaries
        resources:
          limits:
            cpu: 100m
            memory: 256Mi
          requests:
            cpu: 40m
            memory: 64Mi
      containers:
      - name: syncer
        image: "ghcr.io/loft-sh/vcluster:0.19.5"
        args:
          - --name=vcluster
          - --kube-config=/data/k3s-config/kube-config.yaml
          - --service-account=vc-workload-vcluster          
          - --kube-config-context-name=my-vcluster
          - --leader-elect=false          
          - --sync=-ingressclasses                    
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8443
            scheme: HTTPS
          failureThreshold: 60
          initialDelaySeconds: 60
          periodSeconds: 2
        startupProbe:
          httpGet:
            path: /readyz
            port: 8443
            scheme: HTTPS
          failureThreshold: 300
          periodSeconds: 6
        readinessProbe:
          httpGet:
            path: /readyz
            port: 8443
            scheme: HTTPS
          failureThreshold: 60
          periodSeconds: 2
        securityContext:
          allowPrivilegeEscalation: false
          runAsGroup: 0
          runAsUser: 0
        env:          
          - name: VCLUSTER_DISTRO
            value: k3s
          - name: POD_NAME
            valueFrom:
              fieldRef:
                fieldPath: metadata.name
          - name: POD_IP
            valueFrom:
              fieldRef:
                fieldPath: status.podIP
          - name: VCLUSTER_COMMAND
            value: |-
              command:
              
              - /binaries/k3s
              args:
              - server
              - --write-kubeconfig=/data/k3s-config/kube-config.yaml
              - --data-dir=/data
              - --disable=traefik,servicelb,metrics-server,local-storage,coredns
              - --disable-network-policy
              - --disable-agent
              - --disable-cloud-controller
              - --egress-selector-mode=disabled
              - --flannel-backend=none
              - --kube-apiserver-arg=bind-address=127.0.0.1
              - --disable-scheduler
              - --kube-controller-manager-arg=controllers=*,-nodeipam,-nodelifecycle,-persistentvolume-binder,-attachdetach,-persistentvolume-expander,-cloud-node-lifecycle,-ttl
              - --kube-apiserver-arg=endpoint-reconciler-type=none
          - name: VCLUSTER_NODE_NAME
            valueFrom:
              fieldRef:
                fieldPath: spec.nodeName
          - name: CONFIG
            value: |-
              ---
          - name: VCLUSTER_TELEMETRY_CONFIG
            value: "{\"disabled\":true,\"instanceCreator\":\"helm\",\"machineID\":\"\",\"platformInstanceID\":\"\",\"platformUserID\":\"\"}"
        volumeMounts:          
          - name: binaries
            mountPath: /binaries
          - name: helm-cache
            mountPath: /.cache/helm
          - name: config
            mountPath: /etc/rancher
          - name: tmp
            mountPath: /tmp
          - name: coredns
            mountPath: /manifests/coredns
            readOnly: true
          - name: custom-config-volume
            mountPath: /etc/coredns/custom
            readOnly: true
          - mountPath: /data
            name: data
        resources:
          limits:
            ephemeral-storage: 8Gi
            memory: 2Gi
          requests:
            cpu: 200m
            ephemeral-storage: 200Mi
            memory: 256Mi
