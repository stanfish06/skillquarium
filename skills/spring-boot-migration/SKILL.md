---
name: spring-boot-migration
description: Migrate Spring Boot 2.x applications to Spring Boot 3.x. Use when updating pom.xml versions, removing deprecated JAXB dependencies, upgrading Java to 17/21, or using OpenRewrite for automated migration. Covers dependency updates, version changes, and migration checklist.
---

# Spring Boot 2 to 3 Migration Skill

## Overview

This skill provides guidance for migrating Spring Boot applications from version 2.x to 3.x, which is one of the most significant upgrades in Spring Boot history due to the Java EE to Jakarta EE transition.

## Key Migration Steps

### 1. Update Spring Boot Version

Change the parent POM version:

```xml
<!-- Before: Spring Boot 2.7.x -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
</parent>

<!-- After: Spring Boot 3.2.x -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
</parent>
```

`3.2.0` is only an example target. Use the latest 3.x patch release and check the [Spring Boot support timeline](https://spring.io/projects/spring-boot#support), since older 3.x lines no longer get OSS fixes. While migrating, add `spring-boot-properties-migrator`: it reports renamed or removed configuration properties at startup (and maps them temporarily). Remove it once the warnings are fixed:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-properties-migrator</artifactId>
    <scope>runtime</scope>
</dependency>
```

### 2. Update Java Version

Spring Boot 3 requires Java 17 or later:

```xml
<properties>
    <!-- Before -->
    <java.version>1.8</java.version>

    <!-- After -->
    <java.version>21</java.version>
</properties>
```

### 3. Replace Java EE JAXB Dependencies

Remove the old `javax.xml.bind:jaxb-api` dependency and the related artifacts listed below. They are Java EE artifacts that Spring Boot 2.x projects often added for Java 9+ compatibility, and Spring Boot 3 libraries expect `jakarta.xml.bind` instead. If the code actually uses JAXB, replace them with the Jakarta artifacts shown under "If You Need XML Binding in Spring Boot 3" and change the imports to `jakarta.xml.bind`. If nothing uses JAXB (it was often added only because jjwt 0.9.x needed `javax.xml.bind.DatatypeConverter` on Java 9+), delete them.

#### Dependencies to REMOVE from pom.xml

```xml
<!-- Java EE artifacts: remove, or replace with the Jakarta artifacts below if JAXB is used -->

<!-- Old JAXB API -->
<dependency>
    <groupId>javax.xml.bind</groupId>
    <artifactId>jaxb-api</artifactId>
</dependency>

<!-- Old JAXB Implementation -->
<dependency>
    <groupId>com.sun.xml.bind</groupId>
    <artifactId>jaxb-impl</artifactId>
</dependency>

<dependency>
    <groupId>com.sun.xml.bind</groupId>
    <artifactId>jaxb-core</artifactId>
</dependency>

<!-- Old Java Activation -->
<dependency>
    <groupId>javax.activation</groupId>
    <artifactId>activation</artifactId>
</dependency>

<dependency>
    <groupId>javax.activation</groupId>
    <artifactId>javax.activation-api</artifactId>
</dependency>
```

#### Why Remove These?

1. **Namespace Conflict**: `javax.xml.bind` uses the old Java EE namespace, which conflicts with Jakarta EE's `jakarta.xml.bind`
2. **Spring Boot 3 Manages Jakarta XML Bind Versions**: If you need XML binding, add the Jakarta artifacts below without `<version>` tags; Spring Boot's dependency management supplies the versions
3. **Build Failures**: Having both `javax.xml.bind` and `jakarta.xml.bind` on the classpath causes ClassNotFoundException and other runtime errors

#### If You Need XML Binding in Spring Boot 3

Use the Jakarta versions instead:

```xml
<!-- Only add these if you actually need XML binding -->
<dependency>
    <groupId>jakarta.xml.bind</groupId>
    <artifactId>jakarta.xml.bind-api</artifactId>
</dependency>
<dependency>
    <groupId>org.glassfish.jaxb</groupId>
    <artifactId>jaxb-runtime</artifactId>
</dependency>
```

#### Quick Check for Old JAXB Dependencies

```bash
# Check if old JAXB is in your pom.xml
grep -E "javax\.xml\.bind|jaxb-api" pom.xml

# If this returns any results, you need to remove those dependencies
```

#### Verify Removal

After removing, confirm no old JAXB references remain:

```bash
# This should return NO results
grep -E "<artifactId>jaxb-api</artifactId>" pom.xml
grep -E "javax\.xml\.bind" pom.xml
```

### 4. Update JWT Library

The old `jjwt` library needs to be replaced with the newer modular version:

```xml
<!-- Before -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt</artifactId>
    <version>0.9.1</version>
</dependency>

<!-- After -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.3</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.3</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.3</version>
    <scope>runtime</scope>
</dependency>
```

Code written for jjwt 0.9.x usually stops compiling after the artifact swap, because 0.12 changed the Java API (`Jwts.parser()` now returns a builder):

```java
// Before (jjwt 0.9.x)
String token = Jwts.builder()
    .setSubject(username)
    .setIssuedAt(now)
    .setExpiration(expiry)
    .signWith(SignatureAlgorithm.HS512, secret)
    .compact();
Claims claims = Jwts.parser()
    .setSigningKey(secret)
    .parseClaimsJws(token)
    .getBody();

// After (jjwt 0.12.x)
SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
String token = Jwts.builder()
    .subject(username)
    .issuedAt(now)
    .expiration(expiry)
    .signWith(key)
    .compact();
Claims claims = Jwts.parser()
    .verifyWith(key)
    .build()
    .parseSignedClaims(token)
    .getPayload();
```

In 0.9.x, `signWith(alg, String)` and `setSigningKey(String)` Base64-decode the string, so build the new key with `Decoders.BASE64.decode(secret)` to keep existing tokens valid. `Keys.hmacShaKeyFor` throws `WeakKeyException` for keys shorter than 256 bits, and `signWith(key)` picks HS256/384/512 from the key length. `Jwts.parserBuilder()`, `setSigningKey` and the `set*` builder methods still exist in 0.12 but are deprecated.

## Common Issues

### Issue 1: Compilation Errors After Upgrade

After changing the Spring Boot version, you'll see many compilation errors related to `javax.*` imports. These need to be changed to `jakarta.*` (see Jakarta Namespace skill).

### Issue 2: Hibernate 6 Dialect Names

Hibernate 6 detects the dialect and database version from the JDBC connection, so `spring.jpa.database-platform` can usually be removed. Version-specific dialect classes are deprecated or moved in favour of one class per database:

```properties
# Before (Hibernate 5)
spring.jpa.database-platform=org.hibernate.dialect.MySQL8Dialect

# After (Hibernate 6), or remove the property
spring.jpa.database-platform=org.hibernate.dialect.MySQLDialect
```

Other common renames: `PostgreSQL95Dialect`/`PostgreSQL10Dialect` -> `PostgreSQLDialect`, `Oracle12cDialect` -> `OracleDialect`, `SQLServer2012Dialect` -> `SQLServerDialect`, `MariaDB103Dialect` -> `MariaDBDialect`. `org.hibernate.dialect.H2Dialect` keeps its name. Dialects for older or less common databases live in the `org.hibernate.orm:hibernate-community-dialects` artifact.

### Issue 3: Actuator Endpoints

Actuator endpoint paths have changed. Review your security configuration if you're exposing actuator endpoints.

## Migration Commands

### Update pom.xml with sed

```bash
# Update Spring Boot parent version
sed -i 's/<version>2\.7\.[0-9]*<\/version>/<version>3.2.0<\/version>/g' pom.xml

# Update Java version
sed -i 's/<java.version>1\.8<\/java.version>/<java.version>21<\/java.version>/g' pom.xml
sed -i 's/<java.version>8<\/java.version>/<java.version>21<\/java.version>/g' pom.xml
sed -i 's/<java.version>11<\/java.version>/<java.version>21<\/java.version>/g' pom.xml

# Remove old JAXB dependency (multi-line removal is complex - manual removal recommended)
```

### Remove Deprecated Dependencies

```bash
# Check for old JAXB dependencies
grep -n "jaxb-api\|javax\.xml\.bind" pom.xml

# These must be manually removed from pom.xml:
# - javax.xml.bind:jaxb-api
# - com.sun.xml.bind:jaxb-impl
# - com.sun.xml.bind:jaxb-core
```

## Using OpenRewrite for Automated Migration

OpenRewrite is the recommended tool for large-scale migrations:

### Add OpenRewrite Plugin to pom.xml

```xml
<plugin>
    <groupId>org.openrewrite.maven</groupId>
    <artifactId>rewrite-maven-plugin</artifactId>
    <version>5.42.0</version>
    <configuration>
        <activeRecipes>
            <recipe>org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_2</recipe>
        </activeRecipes>
    </configuration>
    <dependencies>
        <dependency>
            <groupId>org.openrewrite.recipe</groupId>
            <artifactId>rewrite-spring</artifactId>
            <version>5.21.0</version>
        </dependency>
    </dependencies>
</plugin>
```

### Run OpenRewrite Migration

```bash
mvn rewrite:run
```

This will automatically:
- Update Spring Boot version
- Migrate `javax.*` to `jakarta.*` imports
- Update deprecated Spring Security patterns
- Fix property name changes

## Verification Steps

### Check Spring Boot Version

```bash
# Should show 3.x version
grep -A2 "spring-boot-starter-parent" pom.xml | grep version
```

### Check Java Version

```bash
# Should show 17 or 21
grep "java.version" pom.xml
```

### Check for Old Dependencies

```bash
# All should return NO results
grep "jaxb-api" pom.xml
grep "javax\.xml\.bind" pom.xml
grep "<version>0\.9\.1</version>" pom.xml  # Old jjwt version
```

### Compile and Test

```bash
# Compile the project
mvn clean compile

# Run tests
mvn test
```

## Migration Checklist

- [ ] Update `spring-boot-starter-parent` to the latest 3.x patch release (3.2.x is only an example)
- [ ] Add `spring-boot-properties-migrator` temporarily and fix the property renames it reports
- [ ] Update `java.version` to 17 or 21
- [ ] Remove `javax.xml.bind:jaxb-api` and related JAXB dependencies
- [ ] Remove old `io.jsonwebtoken:jjwt` if present, replace with modular jjwt
- [ ] Run `mvn clean compile` to identify remaining issues
- [ ] Fix all `javax.*` to `jakarta.*` imports
- [ ] Update Spring Security configuration (see Spring Security 6 skill)
- [ ] Replace RestTemplate with RestClient (see RestClient Migration skill)
- [ ] Run tests to verify functionality

## Recommended Migration Order

1. **First**: Upgrade to Spring Boot 2.7.x (latest 2.x) if not already
2. **Second**: Update Java version to 17 or 21
3. **Third**: Remove incompatible dependencies (JAXB, old JWT)
4. **Fourth**: Update Spring Boot parent to the latest 3.x patch release
5. **Fifth**: Fix namespace imports (javax → jakarta)
6. **Sixth**: Update Spring Security configuration
7. **Seventh**: Update HTTP clients (RestTemplate → RestClient)
8. **Finally**: Run full test suite

## Sources

- [Spring Boot 3.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.0-Migration-Guide)
- [OpenRewrite Spring Boot 3 Migration](https://docs.openrewrite.org/running-recipes/popular-recipe-guides/migrate-to-spring-3)
- [Baeldung - Migrate to Spring Boot 3](https://www.baeldung.com/spring-boot-3-migration)
