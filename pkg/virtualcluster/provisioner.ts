import { IClusterProvisioner, ClusterProvisionerContext } from '@shell/core/types';
import CruVCluster from './components/CruVCluster.vue';
import { mapDriver } from '@shell/store/plugins';
import { Component } from 'vue/types/umd';

type ICluster = any;

export class VClustersProvisioner implements IClusterProvisioner {
  static ID = 'vcluster'

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
}
