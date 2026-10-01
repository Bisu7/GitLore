from neo4j import GraphDatabase
from django.conf import settings
import atexit

class Neo4jConnection:
    _instance = None
    _driver = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Neo4jConnection, cls).__new__(cls)
            try:
                cls._driver = GraphDatabase.driver(
                    settings.NEO4J_URI,
                    auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD)
                )
            except Exception as e:
                print(f"Failed to connect to Neo4j: {e}")
                cls._driver = None
                
            # Register cleanup
            atexit.register(cls._instance.close)
        return cls._instance

    @property
    def driver(self):
        return self._driver

    def close(self):
        if self._driver:
            self._driver.close()

# Singleton instance
neo4j_conn = Neo4jConnection()
driver = neo4j_conn.driver
