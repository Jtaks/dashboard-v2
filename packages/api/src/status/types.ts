export type DockerContainer = {
  names: string[];
  state: string;
  healthStatus?: string;
  startedAt?: string;
};

export type ContainerReading = {
  status: import('@dashboard/shared').Status;
  since: string | null;
};
