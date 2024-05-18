import { ModulesConfig } from "@proto-kit/common";
import { Balances, UInt64 } from "@proto-kit/library";

export const modules = {
  Balances,
};

export const config: ModulesConfig<typeof modules> = {
  Balances: {},
};

export default {
  modules,
  config,
};
