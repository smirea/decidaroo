import { useEffect, useState } from 'react';

type AnyObject = Record<string, any>;

export type LocalStorageOptions<T extends AnyObject> = {
	namespace: string;
	getDefaults?: () => Partial<T>;
	store?: AnyObject;
};

export class LocalStorage<T extends AnyObject = AnyObject> {
	options: Required<LocalStorageOptions<T>>;
	public readonly prefix: string;
	private onChangeEvents = new Set<(diff: Partial<T>) => void>();
	private eventsEnabled = false;

	constructor({ namespace, getDefaults, store }: LocalStorageOptions<T>) {
		this.options = {
			namespace,
			getDefaults: getDefaults ?? (() => ({})),
			store: store ?? globalThis.localStorage,
		};
		this.prefix = `${this.options.namespace}:`;
		this.set({
			...this.options.getDefaults(),
			...this.getAll(),
		});
		this.eventsEnabled = true;
	}

	private getKeyName(key: keyof T) {
		return this.prefix + String(key);
	}

	private getAllKeys(): (keyof T)[] {
		return Object.keys(this.options.store)
			.filter(key => key.startsWith(this.prefix))
			.map(key => key.slice(this.prefix.length) as keyof T);
	}

	private setKey(key: keyof T, value: T[keyof T]) {
		this.options.store[this.getKeyName(key)] = JSON.stringify(value);
	}

	private deleteKey(key: keyof T) {
		delete this.options.store[this.getKeyName(key)];
	}

	getAll({ defaults = true } = {}): T {
		const result: Partial<T> = defaults ? this.options.getDefaults() : {};
		this.getAllKeys().forEach(key => (result[key] = this.get(key)));
		return result as T;
	}

	get<K extends keyof T>(key: K, defaultValue?: T[K]) {
		try {
			const value = this.options.store[this.getKeyName(key)];
			if (value !== undefined) return JSON.parse(value) as T[K];
		} catch {
			this.deleteKey(key);
		}

		return defaultValue !== undefined ? defaultValue : this.options.getDefaults()[key];
	}

	set(diff: Partial<T>) {
		for (const [key, value] of Object.entries(diff) as Array<[keyof T, T[keyof T] | undefined]>) {
			if (value !== undefined) {
				this.setKey(key, value);
			} else {
				this.deleteKey(key);
			}
		}

		this.triggerChange(diff);
	}

	delete(key: keyof T) {
		this.deleteKey(key);
		this.triggerChange({ [key]: undefined } as Partial<T>);
	}

	reset() {
		this.getAllKeys().forEach(key => this.deleteKey(key));
		this.set(this.options.getDefaults());
	}

	onChange(callback: (diff: Partial<T>) => void) {
		this.onChangeEvents.add(callback);

		return () => void this.onChangeEvents.delete(callback);
	}

	private triggerChange(diff: Partial<T>) {
		if (!this.eventsEnabled) return;
		for (const callback of this.onChangeEvents) callback(diff);
	}
}

export default function createLocalStorage<Shape extends AnyObject>(options: LocalStorageOptions<Shape>) {
	const LS = new LocalStorage<Shape>(options);

	const useLocalStorage = <K extends keyof Shape>(key: K, defaultValue?: Shape[K]) => {
		const [value, setValue] = useState<Shape[K] | undefined>(() => LS.get(key, defaultValue));

		useEffect(() => LS.set({ [key]: value } as Partial<Shape>), [key, value]);

		useEffect(() => {
			return LS.onChange(diff => {
				if (key in diff) setValue(diff[key]);
			});
		}, [key]);

		return [value, setValue] as const;
	};

	return { LS, useLocalStorage };
}
