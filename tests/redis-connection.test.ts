import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRedisConnectionOptions } from "../src/lib/queue/connection";

describe("Redis connection options", () => {
  it("enables TLS and decodes Azure Managed Redis credentials", () => {
    assert.deepEqual(
      getRedisConnectionOptions(
        "rediss://default:p%40ss@example.redis.azure.net:10000/2",
      ),
      {
        host: "example.redis.azure.net",
        port: 10000,
        username: "default",
        password: "p@ss",
        db: 2,
        maxRetriesPerRequest: null,
        tls: {},
      },
    );
  });

  it("keeps local Redis unencrypted and defaults to port 6379", () => {
    const options = getRedisConnectionOptions("redis://localhost");
    assert.equal(options.port, 6379);
    assert.equal(options.tls, undefined);
  });
});