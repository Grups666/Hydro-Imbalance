/**
 * Build the browser runtime graph from the complete literature knowledge graph.
 * The full catalog remains the source of truth; the browser receives only records
 * referenced by active region relations.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const sourcePath = path.join(root, "public/modules/water-imbalance/data/knowledge-graph.json");
const outputPath = path.join(root, "public/modules/water-imbalance/data/runtime-graph.json");
const scholarRegistryPath = path.join(root, "catalog/authors/scholar-profiles.json");
const graph = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const scholarRegistry = JSON.parse(fs.readFileSync(scholarRegistryPath, "utf8"));
const relations = graph.relations || [];
const recordIds = new Set(relations.map((relation) => relation.source).filter(Boolean));
const records = Object.fromEntries(
  Object.entries(graph.literature?.records || {}).filter(([id]) => recordIds.has(id))
);
const authors = {};
const authorIdsByKey = new Map();
const authorshipRelations = [];

function normalizeAuthorName(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function authorIdFor(name) {
  const key = normalizeAuthorName(name);
  if (authorIdsByKey.has(key)) return authorIdsByKey.get(key);
  const base = `author_${key.replace(/\s+/g, "_").slice(0, 70) || "unknown"}`;
  let id = base;
  let suffix = 2;
  while (authors[id]) id = `${base}_${suffix++}`;
  authorIdsByKey.set(key, id);
  return id;
}

function parseAuthors(record) {
  if (Array.isArray(record.author_profiles)) {
    return record.author_profiles.map((author) => ({
      name: author.name || author.display_name,
      openalex_id: author.openalex_id || author.id || "",
      orcid: author.orcid || "",
      scholar_url: author.scholar_url || "",
      affiliations: author.affiliations || []
    })).filter((author) => author.name);
  }

  return String(record.authors || "")
    .replace(/\bet al\.?$/i, "")
    .split(/\s*,\s*(?=(?:and\s+)?(?:(?:van|von|de|der|den|da|del|di|la|le)\s+)*[A-Z][A-Za-z' -]+,\s*[A-Z])|\s*,?\s+and\s+|,\s*(?=[A-Z][a-z]+(?:\s+[A-Z][A-Za-z.'-]+)+)/)
    .map((name) => ({ name: name.trim().replace(/^and\s+/i, "").replace(/,\s*$/, "") }))
    .filter((author) => author.name);
}

for (const [paperId, record] of Object.entries(records)) {
  record.authorIds = [];
  for (const [position, profile] of parseAuthors(record).entries()) {
    const authorId = authorIdFor(profile.name);
    if (!authors[authorId]) {
      const verifiedProfile = scholarRegistry[authorId] || {};
      authors[authorId] = {
        id: authorId,
        name: profile.name,
        aliases: [],
        openalex_id: profile.openalex_id || "",
        orcid: profile.orcid || "",
        scholar_url: verifiedProfile.scholar_url || profile.scholar_url || "",
        scholar_verification: verifiedProfile.scholar_url ? {
          verified_name: verifiedProfile.verified_name,
          verified_by: verifiedProfile.verified_by,
          verified_on: verifiedProfile.verified_on
        } : null,
        affiliations: profile.affiliations || []
      };
    }
    record.authorIds.push(authorId);
    authorshipRelations.push({
      type: "paper_authored_by",
      source: paperId,
      target: authorId,
      position
    });
  }
}

const runtimeGraph = {
  schema: "water-imbalance-literature/v2",
  module: graph.module,
  generatedFrom: [path.relative(root, sourcePath).replace(/\\/g, "/")],
  spatialContexts: graph.spatialContexts,
  literature: { records },
  authors: { records: authors },
  relations: [...relations, ...authorshipRelations]
};

fs.writeFileSync(outputPath, JSON.stringify(runtimeGraph, null, 2) + "\n");
console.log(
  `Wrote ${path.relative(root, outputPath)} with ${Object.keys(records).length} papers and ${Object.keys(authors).length} authors.`
);
