import { BaseEntity } from './BaseEntity';

export class EntityManager<T extends BaseEntity<any>> {
  protected entities = new Map<string, T>();

  add(entity: T) {
    this.entities.set(entity.id, entity);
    return entity;
  }

  get(id: string) {
    return this.entities.get(id);
  }

  remove(id: string) {
    this.entities.delete(id);
  }

  values() {
    return Array.from(this.entities.values());
  }

  update(deltaMs: number) {
    this.entities.forEach((entity) => entity.update(deltaMs));
  }

  toRecord<TSnapshot extends { id: string }>() {
    const record: Record<string, TSnapshot> = {};
    this.entities.forEach((entity) => {
      record[entity.id] = entity.getSnapshot() as TSnapshot;
    });
    return record;
  }

  clear() {
    this.entities.clear();
  }
}
