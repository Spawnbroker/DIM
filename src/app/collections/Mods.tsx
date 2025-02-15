import {
  DestinyInventoryItemDefinition,
  DestinyProfileResponse,
  DestinyItemPlug
} from 'bungie-api-ts/destiny2';
import React from 'react';
import _ from 'lodash';
import { D2ManifestDefinitions } from '../destiny2/d2-definitions';
import './collections.scss';
import { RootState } from 'app/store/reducers';
import { createSelector } from 'reselect';
import { storesSelector } from 'app/inventory/reducer';
import CollapsibleTitle from 'app/dim-ui/CollapsibleTitle';
import { connect } from 'react-redux';
import { InventoryBuckets } from 'app/inventory/inventory-buckets';
import Mod from './Mod';
import { chainComparator, compareBy } from 'app/utils/comparators';

const sortMods = chainComparator(
  compareBy((i: DestinyInventoryItemDefinition) => i.itemTypeDisplayName),
  compareBy((i: DestinyInventoryItemDefinition) => i.displayProperties.name)
);

interface ProvidedProps {
  profileResponse: DestinyProfileResponse;
}

interface StoreProps {
  defs?: D2ManifestDefinitions;
  buckets?: InventoryBuckets;
  ownedMods: Set<number>;
  allMods: DestinyInventoryItemDefinition[];
  modsOnItems: Set<number>;
}

const ownedModsSelector = createSelector(
  storesSelector,
  (stores) => new Set(stores.flatMap((s) => s.buckets[3313201758].map((i) => i.hash)))
); //                                InventoryBucket "Modifications"

const modsOnitemsSelector = createSelector(
  storesSelector,
  (stores) => {
    const modsOnItems = new Set<number>();
    for (const store of stores) {
      for (const item of store.items) {
        if (item.isDestiny2() && item.sockets && item.sockets.categories.length > 1) {
          for (const socket of item.sockets.categories[1].sockets) {
            if (socket.plug) {
              modsOnItems.add(socket.plug.plugItem.hash);
            }
          }
        }
      }
    }
    return modsOnItems;
  }
);

const allModsSelector = createSelector(
  (state: RootState) => state.manifest.d2Manifest,
  (defs) => {
    if (!defs) {
      return [];
    }
    //                                    InventoryItem "Void Impact Mod"
    const deprecatedModDescription = defs.InventoryItem.get(2988871238).displayProperties
      .description;

    return Object.values(defs.InventoryItem.getAll()).filter((i) =>
      isMod(i, deprecatedModDescription)
    );
  }
);

function mapStateToProps(state: RootState): StoreProps {
  return {
    defs: state.manifest.d2Manifest,
    buckets: state.inventory.buckets,
    ownedMods: ownedModsSelector(state),
    modsOnItems: modsOnitemsSelector(state),
    allMods: allModsSelector(state)
  };
}

type Props = ProvidedProps & StoreProps;

function isMod(i: DestinyInventoryItemDefinition, deprecatedModDescription: string) {
  return (
    i.itemCategoryHashes &&
    i.plug &&
    i.plug.insertionMaterialRequirementHash &&
    i.displayProperties.description !== deprecatedModDescription &&
    ![2600899007, 2323986101, 3851138800].includes(i.hash) &&
    (i.itemCategoryHashes.includes(610365472) || i.itemCategoryHashes.includes(4104513227))
    //                ItemCategory "Weapon Mods"                  ItemCategory "Armor Mods"
  );
}

function Mods({ defs, buckets, allMods, ownedMods, modsOnItems, profileResponse }: Props) {
  if (!defs || !buckets) {
    return null;
  }

  //                                    InventoryItem "Void Impact Mod"
  const deprecatedModDescription = defs.InventoryItem.get(2988871238).displayProperties.description;
  const mods = new Set<number>();

  const processPlugSet = (plugs: { [key: number]: DestinyItemPlug[] }) => {
    _.forIn(plugs, (plugSet, plugSetHash) => {
      const plugSetDef = defs.PlugSet.get(parseInt(plugSetHash, 10));
      for (const item of plugSetDef.reusablePlugItems) {
        const itemDef = defs.InventoryItem.get(item.plugItemHash);
        if (!mods.has(itemDef.hash) && isMod(itemDef, deprecatedModDescription)) {
          mods.add(itemDef.hash);
          if (plugSet.some((k) => k.plugItemHash === itemDef.hash && k.enabled)) {
            ownedMods.add(itemDef.hash);
          }
        }
      }
    });
  };

  if (profileResponse.profilePlugSets.data) {
    processPlugSet(profileResponse.profilePlugSets.data.plugs);
  }

  if (profileResponse.characterPlugSets.data) {
    for (const plugSetData of Object.values(profileResponse.characterPlugSets.data)) {
      processPlugSet(plugSetData.plugs);
    }
  }

  for (const mod of allMods) {
    mods.add(mod.hash);
  }

  allMods = Array.from(mods).map((i) => defs.InventoryItem.get(i));

  const byGroup = _.groupBy(allMods, (i) =>
    i.itemCategoryHashes.includes(610365472) ? 'weapons' : 'armor'
  );

  const modsTitle = defs.ItemCategory.get(56).displayProperties.name;
  const weaponModsTitle = defs.ItemCategory.get(610365472).displayProperties.name;
  const armorModsTitle = defs.ItemCategory.get(4104513227).displayProperties.name;

  return (
    <CollapsibleTitle title={modsTitle} sectionId="mods">
      <div className="presentation-node always-expanded mods">
        <div className="title">{weaponModsTitle}</div>
        <div className="collectibles">
          {byGroup.weapons.sort(sortMods).map((mod) => (
            <Mod
              key={mod.hash}
              inventoryItem={mod}
              defs={defs}
              buckets={buckets}
              owned={ownedMods.has(mod.hash)}
              onAnItem={modsOnItems.has(mod.hash)}
            />
          ))}
        </div>
      </div>
      <div className="presentation-node always-expanded mods">
        <div className="title">{armorModsTitle}</div>
        <div className="collectibles">
          {byGroup.armor.sort(sortMods).map((mod) => (
            <Mod
              key={mod.hash}
              inventoryItem={mod}
              defs={defs}
              buckets={buckets}
              owned={ownedMods.has(mod.hash)}
              onAnItem={modsOnItems.has(mod.hash)}
            />
          ))}
        </div>
      </div>
    </CollapsibleTitle>
  );
}

export default connect<StoreProps>(mapStateToProps)(Mods);
