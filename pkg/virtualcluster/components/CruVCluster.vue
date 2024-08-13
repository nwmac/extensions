<script>
import CreateEditView from '@shell/mixins/create-edit-view';

import CruResource from '@shell/components/CruResource';
import Loading from '@shell/components/Loading';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import Tab from '@shell/components/Tabbed/Tab';
import Tabbed from '@shell/components/Tabbed';
import { CAPI } from '@shell/config/types';
import ClusterMembershipEditor, { canViewClusterMembershipEditor } from '@shell/components/form/Members/ClusterMembershipEditor';
import { Banner } from '@components/Banner';
import LabeledSelect from '@shell/components/form/LabeledSelect';

import { HIDE_DESC, mapPref } from '@shell/store/prefs';
import Labels from '@shell/edit/provisioning.cattle.io.cluster/Labels';
import AgentEnv from '@shell/edit/provisioning.cattle.io.cluster/AgentEnv';

const VERSIONS = [
  {
    label: '1.29.0',
    value: 'v1.29.0-k3s1'
  },
  {
    label: '1.28.8',
    value: 'v1.28.8-k3s1'
  },
  {
    label: '1.27.12',
    value: 'v1.27.12-k3s1'
  },
  {
    label: '1.26.15',
    value: 'v1.26.15-k3s1'
  },
  {
    label: '1.25.16',
    value: 'v1.25.16-k3s4'
  },
  {
    label: '1.24.16',
    value: 'v1.24.16-k3s1'
  },
];

export default {
  name: 'CruVirtualCluster',

  components: {
    Banner,
    ClusterMembershipEditor,
    LabeledSelect,
    Loading,
    NameNsDescription,
    CruResource,
    Tab,
    Tabbed,
    Labels,
    AgentEnv,
  },

  mixins: [CreateEditView],

  props: {
    mode: {
      type:     String,
      required: true,
    },

    value: {
      type:     Object,
      required: true,
    },

    provider: {
      type:     String,
      required: true,
    },
  },

  async fetch() {
    if ( this.$store.getters['management/schemaFor'](CAPI.RANCHER_CLUSTER) ) {
      this.allClusters = await this.$store.dispatch('management/findAll', { type: CAPI.RANCHER_CLUSTER });

      // Filter out the virtual ones
      this.allClusters = this.allClusters.filter((c) => c.machineProvider !== 'vcluster');

      if (this.allClusters?.length) {
        this.parentCluster = this.allClusters[0].name;
      }
    }
  },

  data() {
    return {
      membershipUpdate: {},
      parentCluster:    '',
      k8sVersion:       VERSIONS[0].value,
      allClusters:      [],
    };
  },

  computed: {
    canManageMembers() {
      return canViewClusterMembershipEditor(this.$store);
    },

    hideDescriptions: mapPref(HIDE_DESC),

    clusters() {
      return this.allClusters.map((cluster) => cluster.name);
    },

    k8sVersions() {
      return VERSIONS;
    }
  },

  created() {
    this.registerAfterHook(this.saveRoleBindings, 'save-role-bindings');
  },

  methods: {
    done() {
      return this.$router.replace({
        name:   'c-cluster-product-resource-namespace-id',
        params: {
          resource:  CAPI.RANCHER_CLUSTER,
          namespace: this.value.metadata.namespace,
          id:        this.value.metadata.name,
        },
      });
    },

    async saveRoleBindings() {
      await this.value.waitForMgmt();

      if (this.membershipUpdate.save) {
        await this.membershipUpdate.save(this.value.mgmt.id);
      }
    },

    async saveOverride(btnCb) {
      const clusterId = await this.createCluster(this.k8sVersion);

      // This will have created the virtual cluster
      // Create the imported cluster

      // Add annotations
      this.value.metadata = this.value.metadata || {};
      this.value.metadata.annotations = this.value.metadata.annotations || {};
      this.value.metadata.annotations['ui.rancher/provider'] = 'vcluster';
      this.value.metadata.annotations['ui.rancher/parent-cluster'] = clusterId;
      this.value.metadata.annotations['ui.rancher/vcluster-namespace'] = this.value.metadata.name;

      await this.save(btnCb);

      const clusterToken = await this.value.getOrCreateToken();

      while (!clusterToken.command) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      const command = clusterToken.command.split(' ');
      const registrationUrl = command[command.length - 1];
      const importJobYaml = require('../resources/import-job.yaml.md').body;

      if (!importJobYaml) {
        console.error('Could not load import template');

        const a = require('../resources/import-job.yaml.md');
        console.log(a);
        return;
      }

      let templateYaml = importJobYaml.replaceAll(/vnamespace/g, this.value.metadata.name);

      templateYaml = templateYaml.replaceAll(/__url/g, registrationUrl);

      const apply = {
        defaultNamespace: this.value.metadata.name,
        yaml:             templateYaml
      };

      await this.$store.dispatch('management/request', {
        url:    `/v1/management.cattle.io.clusters/${ clusterId }?action=apply`,
        method: 'POST',
        data:   apply
      });
    },

    onMembershipUpdate(update) {
      this.$set(this, 'membershipUpdate', update);
    },

    async createCluster(version) {
      const cluster = this.allClusters.find((c) => c.name === this.parentCluster);
      const normanCluster = await cluster.findNormanCluster();

      try {
        const res = await this.$store.dispatch('management/request', {
          url:    `/k8s/clusters/${ normanCluster.id }/api/v1/namespaces`,
          method: 'POST',
          data:   {
            apiVersion: 'v1',
            kind:       'Namespace',
            metadata:   { name: this.value.metadata.name },
            spec:       {}
          },
        });

        console.log(res); // eslint-disable-line no-console
      } catch (e) {
        console.error(e); // eslint-disable-line no-console
      }

      const clusterYaml = require('../resources/vcluster.yaml.md').body;

      if (!clusterYaml) {
        console.error('Can not load cluster yaml');
        return;
      }

      let templateYaml = clusterYaml.replaceAll(/vnamespace/g, this.value.metadata.name);

      // k8s version
      templateYaml = templateYaml.replaceAll(/K8S_VERSION/g, version);

      const apply = {
        defaultNamespace: this.value.metadata.name,
        yaml:             templateYaml
      };

      await this.$store.dispatch('management/request', {
        url:    `/v1/management.cattle.io.clusters/${ normanCluster.id }?action=apply`,
        method: 'POST',
        data:   apply
      });

      return normanCluster.id;
    }
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <CruResource
    v-else
    :mode="mode"
    :resource="value"
    :errors="errors"
    component-testid="cluster-manager-virtual-cluster"
    @finish="saveOverride"
    @error="e=>errors = e"
  >
    <NameNsDescription
      v-if="!isView"
      v-model="value"
      :mode="mode"
      :namespaced="false"
      name-label="cluster.name.label"
      name-placeholder="cluster.name.placeholder"
      description-label="cluster.description.label"
      description-placeholder="cluster.description.placeholder"
    />

    <Tabbed
      :side-tabs="true"
      default-tab="virtual-cluster"
    >
      <Tab
        name="virtual-cluster"
        label="Cluster"
        :weight="5"
      >
        <div class="row">
          <div class="col span-6">
            <LabeledSelect
              v-model="parentCluster"
              :label="t('vcluster.fields.hostCluster')"
              :localized-label="true"
              :mode="mode"
              :options="clusters"
            />
          </div>
        </div>
        <div class="row mt-20">
          <div class="col span-6">
            <LabeledSelect
              v-model="k8sVersion"
              :label="t('vcluster.fields.k8sVersion')"
              :localized-label="true"
              :mode="mode"
              :options="k8sVersions"
            />
          </div>
        </div>
      </Tab>
      <Tab
        v-if="canManageMembers"
        name="memberRoles"
        label-key="cluster.tabs.memberRoles"
        :weight="3"
      >
        <Banner
          v-if="isEdit"
          color="info"
        >
          {{ t('cluster.memberRoles.removeMessage') }}
        </Banner>
        <ClusterMembershipEditor
          :mode="mode"
          :parent-id="value.mgmt ? value.mgmt.id : null"
          @membership-update="onMembershipUpdate"
        />
      </Tab>
      <AgentEnv
        v-model="value"
        :mode="mode"
      />
      <Labels
        v-model="value"
        :mode="mode"
      />
    </Tabbed>
  </CruResource>
</template>
