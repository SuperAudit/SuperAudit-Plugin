# Playbook Registry Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PLAYBOOK REGISTRY SYSTEM                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         REGISTRATION SOURCES                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   📄 File System          📝 YAML String         🌐 Future: Remote  │
│   ├─ Single file          ├─ Inline YAML         ├─ IPFS           │
│   ├─ Directory            ├─ Dynamic             ├─ URLs            │
│   └─ Recursive scan       └─ Generated           └─ Marketplace     │
│                                                                       │
│   🔧 Builtin Playbooks                                               │
│   ├─ DeFi Vault Security                                            │
│   ├─ ERC20 Security                                                  │
│   └─ Access Control                                                  │
│                                                                       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PLAYBOOK PARSER & VALIDATOR                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   PlaybookParser.parseFromFile()                                    │
│   PlaybookParser.parseFromString()                                  │
│                                                                       │
│   ✓ YAML Parsing          ✓ Schema Validation   ✓ Rule Parsing     │
│   ✓ Metadata Extraction   ✓ Error Collection    ✓ DSL Validation   │
│                                                                       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PLAYBOOK REGISTRY (Singleton)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   STORAGE:                                                           │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  Map<ID, RegisteredPlaybook>                             │     │
│   │  ├─ id: "erc20-security"                                 │     │
│   │  │  ├─ source: { type, location }                        │     │
│   │  │  ├─ meta: { name, author, tags, ... }                 │     │
│   │  │  ├─ parsedPlaybook: ParsedPlaybook                    │     │
│   │  │  ├─ registeredAt: Date                                │     │
│   │  │  ├─ lastUsed: Date                                    │     │
│   │  │  ├─ usageCount: number                                │     │
│   │  │  └─ validated: boolean                                │     │
│   │  └─ ...more playbooks                                    │     │
│   └──────────────────────────────────────────────────────────┘     │
│                                                                       │
│   INDEXES (for fast lookups):                                       │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  Tag Index: Map<tag, Set<playbook IDs>>                  │     │
│   │  ├─ "defi" → ["erc20-security", "vault-security"]        │     │
│   │  ├─ "reentrancy" → ["vault-security", "defi-security"]   │     │
│   │  └─ ...                                                   │     │
│   └──────────────────────────────────────────────────────────┘     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  Author Index: Map<author, Set<playbook IDs>>            │     │
│   │  ├─ "SuperAudit Team" → [ids...]                         │     │
│   │  └─ ...                                                   │     │
│   └──────────────────────────────────────────────────────────┘     │
│                                                                       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         REGISTRY OPERATIONS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  CRUD:                    SEARCH:                  ANALYTICS:        │
│  ├─ register()            ├─ search(criteria)     ├─ getStats()     │
│  ├─ get(id)               ├─ getByTag(tag)        ├─ mostUsed()     │
│  ├─ getAndUse(id)         ├─ getByAuthor(author)  └─ recentlyAdded()│
│  ├─ unregister(id)        └─ getAllTags()                           │
│  └─ validate(id)                                                     │
│                                                                       │
│  PERSISTENCE:             UTILITIES:                                 │
│  ├─ export()              ├─ clear()                                 │
│  └─ import(state)         └─ has(id)                                 │
│                                                                       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        REGISTRY UTILITIES                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  loadRulesFromRegistry(id)           ┌──────────────────────┐       │
│  loadRulesFromMultiplePlaybooks()    │  DSLInterpreter      │       │
│  findAndLoadPlaybooks(criteria)      │  ├─ parseRules()     │       │
│  getRecommendedPlaybooks(patterns)   │  └─ createRules()    │       │
│  formatRegistryStats()                └──────────────────────┘       │
│  formatPlaybookList()                                                │
│  validateAllPlaybooks()                                              │
│  mergePlaybooks()                                                    │
│                                                                       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RULE ENGINE & ANALYSIS                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   Executable Rules (from playbooks)                                  │
│   ├─ Static Analysis Rules                                          │
│   ├─ Dynamic Test Scenarios                                         │
│   └─ Invariant Checks                                                │
│                                    ▼                                 │
│                         Contract Analysis                            │
│                         ├─ CFG Analysis                              │
│                         ├─ Pattern Matching                          │
│                         ├─ Security Checks                           │
│                         └─ AI Enhancement                            │
│                                    ▼                                 │
│                         Analysis Results                             │
│                         ├─ Issues Found                              │
│                         ├─ Severity Levels                           │
│                         └─ Recommendations                           │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘


DATA FLOW:
──────────

1. REGISTRATION FLOW:
   Source → Parser → Validation → Registry Storage → Indexes Updated

2. SEARCH FLOW:
   Search Criteria → Index Lookup → Filter Results → Return Playbooks

3. USAGE FLOW:
   Request by ID → Registry Lookup → Track Usage → Return Playbook
                                    → DSL Interpreter → Rules → Analysis

4. PERSISTENCE FLOW:
   Registry State → Export JSON → Storage (File/DB)
   Storage → Import JSON → Registry State Restored


KEY DESIGN PATTERNS:
────────────────────

1. Singleton Pattern:
   - Single instance of PlaybookRegistry
   - Global access via getPlaybookRegistry()
   - Consistent state across application

2. Registry Pattern:
   - Central catalog of playbooks
   - Indexed for fast lookups
   - Metadata management

3. Factory Pattern:
   - Multiple registration methods
   - Unified RegisteredPlaybook output
   - Source type abstraction

4. Strategy Pattern:
   - Different registration strategies
   - Pluggable search criteria
   - Flexible filtering


PERFORMANCE OPTIMIZATIONS:
───────────────────────────

1. Caching:
   ✓ ParsedPlaybook cached on registration
   ✓ No re-parsing on subsequent access
   ✓ Rules created on-demand, not stored

2. Indexing:
   ✓ Tag index: O(1) lookup by tag
   ✓ Author index: O(1) lookup by author
   ✓ ID map: O(1) lookup by ID

3. Lazy Loading:
   ✓ Rules generated only when needed
   ✓ Search returns references, not copies
   ✓ Minimal memory footprint


INTEGRATION POINTS:
───────────────────

┌─────────────────────┐
│  Hardhat Task       │
│  (analyze.ts)       │
│  ├─ Initialize      │──┐
│  ├─ Register        │  │
│  ├─ Search          │  │
│  └─ Load Rules      │  │
└─────────────────────┘  │
                         │
┌─────────────────────┐  │      ┌─────────────────────┐
│  CLI Interface      │  │      │  Config Files       │
│  ├─ --playbook      │──┼──────│  hardhat.config.ts  │
│  ├─ --playbooks     │  │      │  superaudit:        │
│  ├─ --list-playbooks│  │      │    playbooks: []    │
│  └─ --search        │  │      └─────────────────────┘
└─────────────────────┘  │
                         │
                         ▼
              ┌─────────────────────┐
              │ PLAYBOOK REGISTRY   │
              └─────────────────────┘
```

## Usage Example Flow

```
User Command:
  $ npx hardhat superaudit --search-playbooks "defi,vault"

Flow:
  1. Task initialization
     └─> initializePlaybookRegistry()
         └─> Load builtins
             └─> Register in registry

  2. Handle search flag
     └─> Parse tags: ["defi", "vault"]
         └─> registry.search({ tags: ["defi", "vault"] })
             └─> Check tag index
                 └─> Return matching playbooks

  3. Format output
     └─> formatPlaybookList(results)
         └─> Display to user

  4. User selects playbook
     └─> npx hardhat superaudit --playbook erc20-security

  5. Load and analyze
     └─> loadRulesFromRegistry("erc20-security")
         └─> Get from registry (tracks usage)
             └─> DSLInterpreter.createRules()
                 └─> Run analysis with rules
                     └─> Generate report
```
