import type { Service, ServiceStatus, Status } from '@dashboard/shared';

export type ServiceWithStatus = {
  id: string;
  name: string;
  status: Status | null;
};

export function joinServicesWithStatus(
  catalogServices: readonly Service[],
  statusServices: readonly ServiceStatus[],
): ServiceWithStatus[] {
  const nameById = new Map(catalogServices.map((service) => [service.id, service.name]));

  return statusServices.map((service) => ({
    id: service.id,
    name: nameById.get(service.id) ?? service.id,
    status: service.status,
  }));
}
