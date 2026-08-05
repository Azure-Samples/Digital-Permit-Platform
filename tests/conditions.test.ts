import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateCondition,
  getRequiredDocuments,
  getVisibleFields,
} from "../src/lib/conditions";

describe("conditional rules", () => {
  it("evaluates scalar, collection, numeric, and existence operators", () => {
    const answers = {
      route: "automatic",
      benefits: ["pip", "dla"],
      age: 21,
      notes: "Needs wheelchair access",
      evidence: "uploaded",
    };

    assert.equal(
      evaluateCondition(
        { field: "route", operator: "eq", value: "automatic" },
        answers,
      ),
      true,
    );
    assert.equal(
      evaluateCondition(
        { field: "route", operator: "neq", value: "assessed" },
        answers,
      ),
      true,
    );
    assert.equal(
      evaluateCondition(
        { field: "route", operator: "in", value: ["automatic", "assessed"] },
        answers,
      ),
      true,
    );
    assert.equal(
      evaluateCondition({ field: "age", operator: "gt", value: 17 }, answers),
      true,
    );
    assert.equal(
      evaluateCondition(
        { field: "notes", operator: "contains", value: "WHEELCHAIR" },
        answers,
      ),
      true,
    );
    assert.equal(
      evaluateCondition(
        { field: "benefits", operator: "contains", value: "pip" },
        answers,
      ),
      true,
    );
    assert.equal(
      evaluateCondition(
        { field: "evidence", operator: "exists", value: true },
        answers,
      ),
      true,
    );
  });

  it("filters fields and document requirements from the same answers", () => {
    const answers = { route: "assessed" };
    const fields = [
      { key: "name" },
      {
        key: "medical_details",
        conditionalOn: { field: "route", operator: "eq" as const, value: "assessed" },
      },
      {
        key: "benefit_reference",
        conditionalOn: { field: "route", operator: "eq" as const, value: "automatic" },
      },
    ];
    const documents = [
      { key: "identity", required: true },
      {
        key: "medical_evidence",
        required: true,
        conditionalOn: { field: "route", operator: "eq" as const, value: "assessed" },
      },
    ];

    assert.deepEqual(getVisibleFields(fields, answers), ["name", "medical_details"]);
    assert.deepEqual(getRequiredDocuments(documents, answers), [
      { key: "identity", required: true },
      { key: "medical_evidence", required: true },
    ]);
  });
});