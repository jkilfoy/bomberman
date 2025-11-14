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

  toRecord<TSnapshot extends { id: string }>(): Record<string, TSnapshot> {
    const record: Record<string, TSnapshot> = {};
    this.entities.forEach((entity) => {
      record[entity.id] = entity.getSnapshot() as TSnapshot;
    });
    return record;
  }

  clear() {
    this.entities.clear();
  }

  // For logging purposes
  log(tick?: number) {
    if (this.entities.size === 0) {return;}
    const type = this.entities.values().next().value?.getSnapshot().kind || 'unknown'; 
    console.groupCollapsed((tick !== undefined ? `Tick ${tick}: ` : '') + type + 's');
    this.entities.forEach((entity) => {
      console.log(entity.getSnapshot());
    });
    console.groupEnd();
  }
}
