import 'server-only';
import fixture from './catalog.json';
import type {AdminData, KitchenData, Menu} from '../contracts';

// Immutable visual reference generated from the initial catalog in an isolated database.
export const preview = fixture as {menu:Menu; admin:AdminData; kitchen:KitchenData};
