# Unit Test Plan - FLENVN Backend

## 1. Current Testing Setup
- **Framework**: Jest
- **Test Utils**: @nestjs/testing (Test, TestingModule)
- **E2E Tests**: Supertest configured (test/app.e2e-spec.ts)
- **Configuration**: jest-e2e.json
- **Commands Available**:
  - `npm test` - Run all unit tests
  - `npm run test:watch` - Watch mode
  - `npm run test:cov` - Coverage report
  - `npm run test:e2e` - E2E tests

---

## 2. Test Coverage Strategy (Priority Order)

### HIGH PRIORITY (Core Business Logic)

#### A. Auth Module Tests
**File**: `src/auth/auth.service.spec.ts`
- ✅ Register endpoint
  - Valid registration with unique email
  - Duplicate email rejection
  - Password hashing verification
  - Free plan auto-assignment
  - User response sanitization
- ✅ Login endpoint
  - Valid credentials success
  - Invalid password failure
  - User not found
  - Token generation (access + refresh)
- ✅ Refresh token endpoint
  - Valid refresh token acceptance
  - Expired refresh token rejection
  - Old token revocation
  - New token generation
- ✅ Logout endpoint
  - Token revocation
  - Subsequent requests fail
- ✅ Email verification
  - Valid token success
  - Invalid token rejection

**File**: `src/auth/token.service.spec.ts`
- ✅ Create refresh token
- ✅ Verify refresh token
- ✅ Revoke refresh token
- ✅ Token expiration handling

**File**: `src/auth/jwt.strategy.spec.ts`
- ✅ Valid JWT validation
- ✅ Invalid JWT rejection
- ✅ Payload extraction

#### B. Subscriptions Module Tests
**File**: `src/subscriptions/subscriptions.service.spec.ts`
- ✅ Create subscription plan
- ✅ Get plan by ID
- ✅ List all plans
- ✅ Update plan
- ✅ Delete plan
- ✅ Assign free plan on registration
- ✅ Upgrade subscription
  - Plan upgrade success
  - Deactivate old subscription
  - Activate new subscription
- ✅ Usage validation
  - canAddBook() - within limit
  - canAddBook() - at limit
  - canAddWords() - within limit
  - canAddWords() - exceeds limit
- ✅ Usage tracking
  - updateUserUsage() increments counters
  - Negative values for deletions
- ✅ Get user subscription
  - Active subscription retrieval
  - Active status verification
- ✅ Statistics
  - Current plan details
  - Usage percentages
  - Remaining capacity

**File**: `src/subscriptions/subscriptions.controller.spec.ts`
- ✅ All endpoints with authentication
- ✅ Response serialization

#### C. Books Module Tests
**File**: `src/books/books.service.spec.ts`
- ✅ Create book
  - Valid book creation
  - Word count calculation
  - Subscription limit validation (canAddBook)
  - Subscription limit validation (canAddWords)
  - Usage tracking update
  - totalCards increment on book
- ✅ Read operations
  - Get user's books
  - Get book by ID
  - Get public books
  - Ownership verification
- ✅ Update book
  - Update content
  - Recalculate word count
  - Handle word count increase (validate limit)
  - Handle word count decrease
  - Usage tracking update
- ✅ Delete book
  - Remove book
  - Refund usage (negative update)
  - Decrement totalCards
  - Only owner can delete
- ✅ Word counting utility
  - Accurate whitespace-based splitting
  - Handle empty content
  - Handle multiple spaces
  - Handle special characters

**File**: `src/books/books.controller.spec.ts`
- ✅ All CRUD endpoints
- ✅ Ownership authorization
- ✅ Response format validation

#### D. Flashcards Module Tests
**File**: `src/flashcards/flashcards.service.spec.ts`
- ✅ Create flashcard
  - Valid flashcard creation
  - Word count validation
  - Subscription limit check (canAddWords)
  - Book relationship
  - Increment totalCards on book
  - SM-2 initialization (easeFactor=2.5, interval=0, repetitions=0)
  - Status = NEW
- ✅ Read operations
  - Get flashcard by ID
  - Get all flashcards with filters
  - Ownership verification
- ✅ Update flashcard
  - Update definition/translation
  - Preserve SM-2 state
  - Only owner can update
- ✅ Delete flashcard
  - Remove flashcard
  - Decrement totalCards on book
  - Refund word usage
- ✅ Review (SM-2 Algorithm)
  - Quality 0: easeFactor decreases, interval resets
  - Quality 1-2: Similar behavior to 0
  - Quality 3-5: Successful review
    - easeFactor increases based on quality
    - interval multiplied by easeFactor
    - repetitions incremented
    - nextReviewDate updated correctly
  - Status transitions (NEW→LEARNING→REVIEWING→MASTERED)
- ✅ Get cards for review
  - nextReviewDate IS NULL (new cards)
  - nextReviewDate <= NOW (due cards)
  - Sorted by nextReviewDate ascending
- ✅ Mark as mastered
  - Status set to MASTERED
  - nextReviewDate cleared
- ✅ Get statistics
  - Count by status
  - Due cards calculation
  - Statistics endpoint accuracy

**File**: `src/flashcards/flashcards.controller.spec.ts`
- ✅ All CRUD endpoints
- ✅ Review endpoint
- ✅ Statistics endpoints
- ✅ Ownership protection

#### E. Sessions Module Tests (NEW)
**File**: `src/sessions/sessions.service.spec.ts`
- ✅ Create session
  - Record study session
  - Flashcard ownership verification
  - Session attributes stored correctly
- ✅ Get session history
  - All sessions for user
  - Filter by flashcardId
  - Filter by days range
  - Sorted by creation descending
- ✅ Get study statistics
  - Total sessions count
  - Correct/incorrect/skipped counts
  - Accuracy percentage calculation
  - Average response time
  - Sessions grouped by type
  - Daily statistics aggregation
- ✅ Get streak statistics
  - Current streak calculation
  - Longest streak all-time
  - Streak edge cases (gaps, no sessions)
  - Last study date
- ✅ Delete session
  - Remove session
  - Ownership verification
  - Cannot delete others' sessions

**File**: `src/sessions/sessions.controller.spec.ts`
- ✅ Create endpoint
- ✅ History endpoint with filters
- ✅ Statistics endpoints
- ✅ Streak endpoint
- ✅ Delete endpoint
- ✅ All endpoints JWT-protected

#### F. Users Module Tests
**File**: `src/users/users.service.spec.ts`
- ✅ Get profile
  - Return user data
  - Sanitized response (no password/tokens)
- ✅ Update profile
  - Update username
  - Update email
  - Unique email validation
  - Email already in use rejection
- ✅ Change password
  - Current password validation
  - New password confirmation match
  - Password hashing
  - bcrypt comparison
- ✅ Get all users (admin)
- ✅ Get user by ID
- ✅ Delete user
  - Cascade delete sessions/flashcards/books

**File**: `src/users/users.controller.spec.ts`
- ✅ Profile endpoints
- ✅ Password change
- ✅ Admin user management

### MEDIUM PRIORITY (Configuration & Utilities)

#### G. Global Exception Filter Tests
**File**: `src/common/filters/global-exception.filter.spec.ts`
- ✅ BadRequestException handling
- ✅ NotFoundException handling
- ✅ ForbiddenException handling
- ✅ UnauthorizedException handling
- ✅ Response format consistency

#### H. Response Interceptor Tests
**File**: `src/common/interceptors/response.interceptor.spec.ts`
- ✅ Success response wrapping
- ✅ Data serialization
- ✅ Timestamp addition
- ✅ Error bypass

#### I. JWT Auth Guard Tests
**File**: `src/auth/guards/jwt-auth.guard.spec.ts`
- ✅ Valid JWT acceptance
- ✅ Missing token rejection
- ✅ Invalid token rejection
- ✅ User extraction

---

## 3. Test Structure Template

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let module: TestingModule;
  
  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: RepositoryName,
          useValue: mockRepository,
        },
        {
          provide: DependencyService,
          useValue: mockDependency,
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      const input = {...};
      const expected = {...};
      
      // Act
      const result = await service.methodName(input);
      
      // Assert
      expect(result).toEqual(expected);
      expect(mockRepo.save).toHaveBeenCalledWith(...);
    });

    it('should throw on validation failure', async () => {
      // Arrange
      const invalidInput = {...};
      
      // Act & Assert
      await expect(service.methodName(invalidInput))
        .rejects
        .toThrow(BadRequestException);
    });
  });
});
```

---

## 4. Mock Patterns to Use

### Repository Mocks
```typescript
const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};
```

### Service Mocks
```typescript
const mockSubscriptionService = {
  canAddBook: jest.fn().mockResolvedValue(true),
  canAddWords: jest.fn().mockResolvedValue(true),
  updateUserUsage: jest.fn().mockResolvedValue({}),
};
```

### Query Builder Mocks
```typescript
const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
  getOne: jest.fn(),
};
```

---

## 5. Implementation Phases

### Phase 1: Core Services (Week 1)
- [ ] Auth service & token service
- [ ] Subscriptions service
- [ ] Users service
- **Target Coverage**: 80%+

### Phase 2: Content Modules (Week 2)
- [ ] Books service
- [ ] Flashcards service
- [ ] Sessions service
- **Target Coverage**: 80%+

### Phase 3: Controllers & Guards (Week 3)
- [ ] All controllers
- [ ] JWT auth guard
- [ ] Exception filters
- [ ] Response interceptor
- **Target Coverage**: 70%+

### Phase 4: E2E & Integration (Week 4)
- [ ] E2E authentication flow
- [ ] E2E book creation with subscription validation
- [ ] E2E flashcard review with SM-2
- [ ] E2E session tracking
- **Target Coverage**: Integration tested

---

## 6. Coverage Goals
- **Services**: 85%+ line coverage
- **Controllers**: 75%+ line coverage
- **Guards/Filters**: 90%+ line coverage
- **Overall**: 80%+ line coverage

---

## 7. Test Execution Commands

```bash
# Run all unit tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:cov

# Run specific test file
npm test -- auth.service.spec.ts

# Run specific describe block
npm test -- --testNamePattern="Auth service"

# Run with coverage threshold enforcement
npm test -- --collectCoverageFrom='src/**/*.ts' --coveragePathIgnorePatterns='/node_modules/'
```

---

## 8. Benefits of This Test Plan

✅ **Comprehensive Coverage** - All critical paths tested  
✅ **Organized Structure** - Clear priority levels  
✅ **Reusable Mocks** - Consistent mock patterns  
✅ **Phased Approach** - Can implement incrementally  
✅ **Documentation** - Clear test descriptions  
✅ **Validation** - Catches regressions early  
✅ **Confidence** - Safe refactoring with test safety net  

---

## 9. Next Steps
1. Review this plan with team
2. Approve priority levels and coverage targets
3. Begin Phase 1 implementation
4. Execute tests and monitor coverage
5. Refine based on findings

