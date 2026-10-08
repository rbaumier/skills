# DPIA Risk Catalog

Risks to rights and freedoms of data subjects. Derived from Recital 75 GDPR, EDPB Guidelines WP 248 rev.01, CNIL PIA knowledge bases, EDPB Opinion 28/2024 (AI), EDPB Guidelines 3/2019 (video surveillance), EDPB Guidelines 1/2020 (connected vehicles), and enforcement practice.

Use this catalog to **proactively propose risks** based on the processing description. Select relevant risks — don't present the entire catalog.

---

## Rights Impact Categories

### Discrimination (Art. 21 EU Charter)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| DISC-01 | Algorithmic bias producing discriminatory outcomes | AI/ML scoring, hiring algorithms, credit decisions, insurance pricing |
| DISC-02 | Proxy discrimination via neutral data correlating with protected characteristics | Zip code profiling, browsing patterns, purchasing behavior |
| DISC-03 | Differential service quality based on profiling | Dynamic pricing, tiered service, customer value scoring |
| DISC-04 | Health-status discrimination from wearable/medical data | Insurance exclusions, employment screening via health profiling |

### Identity Theft and Fraud (Art. 8 EU Charter)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| IDTH-01 | Identity theft from exposed personal identifiers | Large-scale databases with names, IDs, dates of birth |
| IDTH-02 | Account takeover from compromised credentials | Password stores, biometric template databases |
| IDTH-03 | Social engineering enabled by detailed profiles | Comprehensive CRM data, behavioral profiles |
| IDTH-04 | Deepfake creation from biometric data | Facial images, voice recordings |

### Financial Loss (Art. 17 EU Charter)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| FINL-01 | Direct loss from unauthorized transactions | Payment data, banking integrations |
| FINL-02 | Credit damage from inaccurate automated scoring | Credit scoring, shared blacklists |
| FINL-03 | Insurance denial or inflation from profiling | Health data, driving behavior, lifestyle data |
| FINL-04 | Employment loss from unfair automated evaluation | Performance AI, hiring/firing algorithms |

### Reputational Damage (Art. 1, 7 EU Charter)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| REPD-01 | Public exposure of private information | Data breaches, unauthorized sharing |
| REPD-02 | Incorrect association with criminal/unethical activity | AML false positives, blacklist errors |
| REPD-03 | Social stigma from disclosed sensitive data | Health conditions, sexual orientation, addiction |
| REPD-04 | AI-generated false biographical information | LLM hallucinations producing incorrect personal facts |

### Loss of Confidentiality (Art. 7 EU Charter, professional secrecy)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| CONF-01 | Breach of professional secrecy (legal, medical, tax) | Law firm data, medical records — connects to §203 StGB in Germany |
| CONF-02 | Unauthorized disclosure to third parties | Processor breaches, over-broad access, cloud provider access |
| CONF-03 | Foreign government access to protected data | US CLOUD Act, Schrems II transfer risks |
| CONF-04 | AI model memorization and data leakage | LLMs reproducing training data, model inversion attacks |

### Reversal of Pseudonymization (Art. 8 EU Charter, Art. 25 GDPR)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| PSEU-01 | Re-identification through data linkage | Pseudonymized data + auxiliary data |
| PSEU-02 | Model inversion / membership inference attacks | ML models revealing training data |
| PSEU-03 | Singling out in "anonymous" datasets | Location traces, transaction patterns, behavioral fingerprints |

### Physical Harm (Art. 2, 3 EU Charter)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| PHYS-01 | Stalking/harassment via location data | Real-time tracking, movement history |
| PHYS-02 | Domestic violence risk from exposed personal data | Shared accounts, family trackers, address disclosure |
| PHYS-03 | Safety risks from vehicle data manipulation | Connected vehicle systems, remote vehicle control |
| PHYS-04 | Medical harm from inaccurate health data | Wrong medication alerts, faulty diagnostic AI |

### Loss of Control Over Personal Data (informational self-determination)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| CTRL-01 | Opaque processing — data subjects cannot understand how data is used | Complex AI, multi-layered data flows |
| CTRL-02 | Inability to exercise rights effectively | Technical barriers, cross-system complexity |
| CTRL-03 | Function creep — data repurposed beyond original collection | Ecosystem platforms, M&A integration, AI training |
| CTRL-04 | Indefinite retention without justification | No deletion policy, blockchain immutability |

### Chilling Effect on Freedoms (Art. 11, 12, 45 EU Charter)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| CHIL-01 | Self-censorship due to surveillance awareness | Workplace monitoring, public surveillance, online tracking |
| CHIL-02 | Deterrence from legitimate activity | Political profiling, social media monitoring, protest surveillance |
| CHIL-03 | Behavioral conformity pressure | Social scoring, employee ranking, reputation systems |

### Denial of Services (access to essential services)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| DENY-01 | Automated denial of essential services | Algorithmic gatekeeping in banking, insurance, housing |
| DENY-02 | Platform ban with significant consequences | Content moderation algorithms |
| DENY-03 | Cross-sector blocking from shared blacklists | Industry exclusion lists, credit bureau entries |

### Manipulation and Exploitation (Art. 1 EU Charter — dignity)
| ID | Risk | Common Triggers |
|----|------|-----------------|
| MANP-01 | Behavioral manipulation through dark patterns | UX exploiting psychological biases |
| MANP-02 | Exploitation of psychological vulnerabilities | Targeted ads to gambling addicts, persons in distress |
| MANP-03 | Micro-targeting for political manipulation | Behavioral profiling for political advertising |

---

## Processing-Specific Risk Profiles

### AI/ML Systems (EDPB Opinion 28/2024)

**Training phase:** DISC-01 (bias), DISC-02 (proxy discrimination), CONF-04 (memorization), PSEU-02 (model inversion), CTRL-03 (function creep from scraping)
**Deployment phase:** REPD-04 (hallucinations), DISC-01 (discriminatory outputs), CTRL-01 (opacity), CTRL-02 (rights exercise difficulty), DENY-01 (automated decisions)

Key point: The anonymization challenge — controllers claiming training data is "anonymous" must be scrutinized. If singling out is possible, data is personal.

### Employee Monitoring (DSK, UODO, CNIL blacklists)
Email/internet monitoring: CHIL-01, CONF-01 (personal emails), CTRL-01
DLP systems: DISC-01 (false positives → discipline), REPD-02, CHIL-01
GPS/fleet tracking: CHIL-01, CTRL-03 (off-hours tracking), PHYS-01

### Video Surveillance / Facial Recognition (EDPB Guidelines 3/2019)
Standard CCTV: CHIL-01, CTRL-03, CHIL-02
Facial recognition: DISC-01 (differential accuracy), REPD-02 (misidentification), IDTH-04 (biometric theft), CHIL-01 (mass surveillance)

### Connected Vehicles (EDPB Guidelines 1/2020)
Location/telemetry: CHIL-01 (movement surveillance), CTRL-03, FINL-03 (insurance)
Biometric (drowsiness): DISC-04, CHIL-01, CTRL-03
Driving behavior: DISC-03, FINL-03, CONF-03

Key mitigation: Edge/local processing. If biometric data stays in the vehicle and never transmits, risk substantially decreases (EDPB recommendation).

### Health/Genetic Data
Health warehouses: PSEU-01, DISC-04, CONF-01
Genetic testing: DISC-04 (familial privacy — testing reveals info about relatives), FINL-03, CTRL-01
Implantable devices: PHYS-04, CONF-02, CTRL-01

### Financial/Credit Processing
Credit scoring: DISC-01, FINL-02, DENY-01, CTRL-01
Shared blacklists: DENY-03, FINL-02, REPD-02
AML/KYC: REPD-02, DENY-01, DISC-04
