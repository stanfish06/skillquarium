# Vault knowledge graph

```bash
python3 .skill-vault/kg/query.py "batch correct single cell data and find markers" --k 10 --json
python3 .skill-vault/kg/build_kg.py     # after build.py; -> vault/graph/graph.json
python3 .skill-vault/kg/validate.py
python3 -m unittest discover -s .skill-vault/tests -p 'test_kg.py'
```

Optional RDF:

```bash
uv pip install -r .skill-vault/kg/requirements-rdf.txt
python3 .skill-vault/kg/to_rdf.py            # -> vault/graph/graph.nq
python3 .skill-vault/kg/validate.py --shacl
```
