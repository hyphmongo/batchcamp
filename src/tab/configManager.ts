import { Configuration } from "../storage";

export class ConfigManager {
  constructor(private _config: Configuration) {}

  public get format() {
    return this._config.format;
  }

  public get concurrency() {
    return this._config.concurrency;
  }

  public get config() {
    return this._config;
  }

  public set config(config: Configuration) {
    this._config = config;
  }
}
