import { ModulesConfig } from "@proto-kit/common";
import { Publish } from "./publish/publish";

export const modules = {
  Publish,
};

export const config: ModulesConfig<typeof modules> = {
  Publish: {},
};

export default {
  modules,
  config,
};
