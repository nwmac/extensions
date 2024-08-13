import { IClusterProvisioner, ClusterProvisionerContext } from '@shell/core/types';
import CruVCluster from './components/CruVCluster.vue';
import { mapDriver } from '@shell/store/plugins';
import { Component } from 'vue/types/umd';

type ICluster = any;

export class VClustersProvisioner implements IClusterProvisioner {
  static ID = 'vcluster'

  // static useForModel(cluster: ICluster) {
  //   return false;
  // }

  constructor(private context: ClusterProvisionerContext) {
    mapDriver(this.id, 'vcluster' );
  }

  get id(): string {
    return VClustersProvisioner.ID;
  }

  get icon(): any {
    return require('./icon.svg');
  }

  get group(): string {
    return 'virtual';
  }

  get label(): string {
    return this.context.t('vcluster.label');
  }

  get component(): Component {
    return CruVCluster;
  }

  get detailTabs(): any {
    return {
      machines:     false,
      logs:         false,
      registration: false,
      snapshots:    false,
      related:      true,
      events:       false,
      conditions:   false,
    };
  }

  machineProviderDisplay(): string {
    return 'vCluster';
  }

  parentCluster(cluster: ICluster): string {
    return cluster.metadata?.annotations?.['ui.rancher/parent-cluster'];
  }

  async postDelete(cluster: ICluster): Promise<any> {
    const parentClusterId = cluster.metadata?.annotations?.['ui.rancher/parent-cluster'];
    const namespace = cluster.metadata?.annotations?.['ui.rancher/vcluster-namespace'];

    // Should probably show a growl
    if (parentClusterId && namespace) {
      try {
        await cluster.$dispatch('request', {
          url:    `/k8s/clusters/${ parentClusterId }/api/v1/namespaces/${ namespace }`,
          method: 'DELETE',
        });
      } catch (e) {
        console.error(e); // eslint-disable-line no-console
      }
    }
  }
}
