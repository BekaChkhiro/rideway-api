# Phase 4: Marketplace & Forum

## Overview

This phase implements the business features: motorcycle marketplace listings, parts catalog with compatibility search, forum discussions, and service provider directory.

## Dependencies

```yaml
# pubspec.yaml - Phase 4 additions
dependencies:
  # Maps
  google_maps_flutter: ^2.5.3
  geolocator: ^11.0.0
  geocoding: ^2.1.1

  # Filtering & Search
  flutter_typeahead: ^5.2.0
  multi_select_flutter: ^4.1.3

  # Price formatting
  intl: ^0.18.1

  # Phone calls
  url_launcher: ^6.2.2
```

---

## 4.1 Marketplace Domain Layer

### Entities

```dart
// lib/features/marketplace/domain/entities/listing.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'listing.freezed.dart';

@freezed
class Listing with _$Listing {
  const factory Listing({
    required String id,
    required User seller,
    required String title,
    required String description,
    required double price,
    required ListingType type,
    required ListingStatus status,
    required ListingCondition condition,
    required List<ListingMedia> media,
    required MotorcycleDetails motorcycle,
    Location? location,
    String? city,
    @Default(0) int viewsCount,
    @Default(0) int favoritesCount,
    @Default(false) bool isFavorited,
    required DateTime createdAt,
    DateTime? updatedAt,
    DateTime? soldAt,
  }) = _Listing;

  const Listing._();

  String get priceFormatted => '${price.toStringAsFixed(0)} ₾';
  bool get isNegotiable => type == ListingType.sale;
}

enum ListingType {
  sale,
  auction,
  trade,
}

enum ListingStatus {
  active,
  pending,
  sold,
  expired,
  removed,
}

enum ListingCondition {
  newBike,
  excellent,
  good,
  fair,
  forParts,
}

@freezed
class MotorcycleDetails with _$MotorcycleDetails {
  const factory MotorcycleDetails({
    required String brand,
    required String model,
    required int year,
    required int mileage,
    required int engineSize, // cc
    String? color,
    String? vin,
    FuelType? fuelType,
    TransmissionType? transmission,
    MotorcycleCategory? category,
  }) = _MotorcycleDetails;
}

enum FuelType {
  petrol,
  electric,
  hybrid,
}

enum TransmissionType {
  manual,
  automatic,
  semiAutomatic,
}

enum MotorcycleCategory {
  sport,
  cruiser,
  touring,
  adventure,
  naked,
  scooter,
  offroad,
  classic,
  custom,
}

@freezed
class ListingMedia with _$ListingMedia {
  const factory ListingMedia({
    required String id,
    required String url,
    String? thumbnailUrl,
    @Default(false) bool isPrimary,
    int? order,
  }) = _ListingMedia;
}
```

```dart
// lib/features/marketplace/domain/entities/listing_filter.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'listing_filter.freezed.dart';

@freezed
class ListingFilter with _$ListingFilter {
  const factory ListingFilter({
    String? searchQuery,
    double? minPrice,
    double? maxPrice,
    List<String>? brands,
    List<String>? models,
    int? minYear,
    int? maxYear,
    int? minMileage,
    int? maxMileage,
    int? minEngineSize,
    int? maxEngineSize,
    List<ListingCondition>? conditions,
    List<MotorcycleCategory>? categories,
    String? city,
    double? maxDistance, // km from user location
    ListingSortBy? sortBy,
    @Default(SortOrder.desc) SortOrder sortOrder,
  }) = _ListingFilter;
}

enum ListingSortBy {
  newest,
  priceAsc,
  priceDesc,
  mileageAsc,
  yearDesc,
  popular,
  distance,
}

enum SortOrder {
  asc,
  desc,
}
```

### Repository Interface

```dart
// lib/features/marketplace/domain/repositories/listing_repository.dart
import 'package:dartz/dartz.dart';

abstract class ListingRepository {
  Future<Either<Failure, PaginatedResponse<Listing>>> getListings({
    required int page,
    int limit = 20,
    ListingFilter? filter,
  });

  Future<Either<Failure, Listing>> getListing(String id);

  Future<Either<Failure, Listing>> createListing(CreateListingRequest request);

  Future<Either<Failure, Listing>> updateListing(String id, UpdateListingRequest request);

  Future<Either<Failure, void>> deleteListing(String id);

  Future<Either<Failure, void>> markAsSold(String id);

  Future<Either<Failure, void>> favoriteListing(String id);

  Future<Either<Failure, void>> unfavoriteListing(String id);

  Future<Either<Failure, List<Listing>>> getFavoriteListings({required int page});

  Future<Either<Failure, List<Listing>>> getUserListings({
    required String userId,
    required int page,
  });

  Future<Either<Failure, List<String>>> getBrands();

  Future<Either<Failure, List<String>>> getModels(String brand);
}
```

---

## 4.2 Marketplace Presentation Layer

### Listings Provider

```dart
// lib/features/marketplace/presentation/providers/listings_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'listings_provider.g.dart';

@riverpod
class ListingsNotifier extends _$ListingsNotifier {
  int _page = 1;
  bool _hasMore = true;
  ListingFilter _filter = const ListingFilter();

  @override
  FutureOr<List<Listing>> build() async {
    _page = 1;
    _hasMore = true;
    return _fetchListings();
  }

  Future<List<Listing>> _fetchListings() async {
    final repository = ref.read(listingRepositoryProvider);
    final result = await repository.getListings(
      page: _page,
      filter: _filter,
    );

    return result.fold(
      (failure) => throw failure,
      (response) {
        _hasMore = response.hasMore;
        return response.data;
      },
    );
  }

  Future<void> refresh() async {
    _page = 1;
    _hasMore = true;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchListings());
  }

  Future<void> loadMore() async {
    if (!_hasMore || state.isLoading) return;

    _page++;
    final currentListings = state.valueOrNull ?? [];

    final result = await ref.read(listingRepositoryProvider).getListings(
      page: _page,
      filter: _filter,
    );

    result.fold(
      (failure) => _page--,
      (response) {
        _hasMore = response.hasMore;
        state = AsyncData([...currentListings, ...response.data]);
      },
    );
  }

  void setFilter(ListingFilter filter) {
    _filter = filter;
    refresh();
  }

  void clearFilter() {
    _filter = const ListingFilter();
    refresh();
  }

  ListingFilter get currentFilter => _filter;
  bool get hasMore => _hasMore;

  void favoriteListing(String listingId) {
    _updateListingInState(listingId, (listing) => listing.copyWith(
      isFavorited: true,
      favoritesCount: listing.favoritesCount + 1,
    ));
    ref.read(listingRepositoryProvider).favoriteListing(listingId);
  }

  void unfavoriteListing(String listingId) {
    _updateListingInState(listingId, (listing) => listing.copyWith(
      isFavorited: false,
      favoritesCount: listing.favoritesCount - 1,
    ));
    ref.read(listingRepositoryProvider).unfavoriteListing(listingId);
  }

  void _updateListingInState(String listingId, Listing Function(Listing) update) {
    final currentListings = state.valueOrNull ?? [];
    state = AsyncData(
      currentListings.map((listing) {
        if (listing.id == listingId) {
          return update(listing);
        }
        return listing;
      }).toList(),
    );
  }
}

// Filter state provider
@riverpod
class ListingFilterState extends _$ListingFilterState {
  @override
  ListingFilter build() => const ListingFilter();

  void updateFilter(ListingFilter filter) {
    state = filter;
  }

  void updateSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
  }

  void updatePriceRange(double? min, double? max) {
    state = state.copyWith(minPrice: min, maxPrice: max);
  }

  void updateBrands(List<String>? brands) {
    state = state.copyWith(brands: brands);
  }

  void updateModels(List<String>? models) {
    state = state.copyWith(models: models);
  }

  void updateYearRange(int? min, int? max) {
    state = state.copyWith(minYear: min, maxYear: max);
  }

  void updateConditions(List<ListingCondition>? conditions) {
    state = state.copyWith(conditions: conditions);
  }

  void updateCategories(List<MotorcycleCategory>? categories) {
    state = state.copyWith(categories: categories);
  }

  void updateSortBy(ListingSortBy? sortBy) {
    state = state.copyWith(sortBy: sortBy);
  }

  void reset() {
    state = const ListingFilter();
  }
}
```

### Marketplace Screen

```dart
// lib/features/marketplace/presentation/screens/marketplace_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class MarketplaceScreen extends ConsumerStatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  ConsumerState<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends ConsumerState<MarketplaceScreen> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  bool _isGridView = true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(listingsNotifierProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final listingsAsync = ref.watch(listingsNotifierProvider);
    final filter = ref.watch(listingFilterStateProvider);
    final hasActiveFilters = filter != const ListingFilter();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Marketplace'),
        actions: [
          IconButton(
            icon: Icon(_isGridView ? Icons.view_list : Icons.grid_view),
            onPressed: () => setState(() => _isGridView = !_isGridView),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.push('/marketplace/create'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search & Filter bar
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search motorcycles...',
                      prefixIcon: const Icon(Icons.search),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear),
                              onPressed: () {
                                _searchController.clear();
                                ref.read(listingFilterStateProvider.notifier)
                                    .updateSearchQuery('');
                                ref.read(listingsNotifierProvider.notifier).refresh();
                              },
                            )
                          : null,
                    ),
                    onSubmitted: (query) {
                      ref.read(listingFilterStateProvider.notifier)
                          .updateSearchQuery(query);
                      ref.read(listingsNotifierProvider.notifier)
                          .setFilter(ref.read(listingFilterStateProvider));
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Badge(
                  isLabelVisible: hasActiveFilters,
                  child: IconButton.filled(
                    icon: const Icon(Icons.tune),
                    onPressed: () => _showFilterSheet(context),
                  ),
                ),
              ],
            ),
          ),

          // Active filters chips
          if (hasActiveFilters)
            SizedBox(
              height: 40,
              child: _ActiveFiltersChips(
                filter: filter,
                onClear: () {
                  ref.read(listingFilterStateProvider.notifier).reset();
                  ref.read(listingsNotifierProvider.notifier).clearFilter();
                },
              ),
            ),

          // Listings
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(listingsNotifierProvider.notifier).refresh(),
              child: listingsAsync.when(
                loading: () => _isGridView
                    ? const ListingsGridShimmer()
                    : const ListingsListShimmer(),
                error: (error, _) => Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text('Failed to load listings'),
                      ElevatedButton(
                        onPressed: () => ref.invalidate(listingsNotifierProvider),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
                data: (listings) {
                  if (listings.isEmpty) {
                    return const _EmptyListings();
                  }

                  return _isGridView
                      ? _ListingsGrid(
                          listings: listings,
                          scrollController: _scrollController,
                          hasMore: ref.read(listingsNotifierProvider.notifier).hasMore,
                        )
                      : _ListingsList(
                          listings: listings,
                          scrollController: _scrollController,
                          hasMore: ref.read(listingsNotifierProvider.notifier).hasMore,
                        );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showFilterSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => const ListingFilterSheet(),
    );
  }
}

class _ListingsGrid extends StatelessWidget {
  final List<Listing> listings;
  final ScrollController scrollController;
  final bool hasMore;

  const _ListingsGrid({
    required this.listings,
    required this.scrollController,
    required this.hasMore,
  });

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      controller: scrollController,
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.75,
      ),
      itemCount: listings.length + (hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= listings.length) {
          return const Center(child: CircularProgressIndicator());
        }
        return ListingGridCard(listing: listings[index]);
      },
    );
  }
}

class _ListingsList extends StatelessWidget {
  final List<Listing> listings;
  final ScrollController scrollController;
  final bool hasMore;

  const _ListingsList({
    required this.listings,
    required this.scrollController,
    required this.hasMore,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      controller: scrollController,
      padding: const EdgeInsets.all(12),
      itemCount: listings.length + (hasMore ? 1 : 0),
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        if (index >= listings.length) {
          return const Center(
            padding: EdgeInsets.all(16),
            child: CircularProgressIndicator(),
          );
        }
        return ListingListCard(listing: listings[index]);
      },
    );
  }
}
```

### Listing Card Widget

```dart
// lib/features/marketplace/presentation/widgets/listing_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

class ListingGridCard extends ConsumerWidget {
  final Listing listing;

  const ListingGridCard({super.key, required this.listing});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () => context.push('/marketplace/${listing.id}'),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CachedNetworkImage(
                    imageUrl: listing.media.isNotEmpty
                        ? listing.media.first.url
                        : 'placeholder',
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      color: AppColors.surface,
                      child: const Center(child: CircularProgressIndicator()),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      color: AppColors.surface,
                      child: const Icon(Icons.image_not_supported),
                    ),
                  ),

                  // Status badge
                  if (listing.status == ListingStatus.sold)
                    Container(
                      color: Colors.black54,
                      alignment: Alignment.center,
                      child: const Text(
                        'SOLD',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                        ),
                      ),
                    ),

                  // Favorite button
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: () {
                        final notifier = ref.read(listingsNotifierProvider.notifier);
                        if (listing.isFavorited) {
                          notifier.unfavoriteListing(listing.id);
                        } else {
                          notifier.favoriteListing(listing.id);
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.black38,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          listing.isFavorited
                              ? Icons.favorite
                              : Icons.favorite_border,
                          color: listing.isFavorited ? Colors.red : Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                  ),

                  // Image count badge
                  if (listing.media.length > 1)
                    Positioned(
                      bottom: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.photo_library,
                              color: Colors.white,
                              size: 14,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${listing.media.length}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // Info
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    listing.priceFormatted,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${listing.motorcycle.brand} ${listing.motorcycle.model}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${listing.motorcycle.year} • ${_formatMileage(listing.motorcycle.mileage)} km',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  if (listing.city != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.location_on_outlined,
                          size: 12,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            listing.city!,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatMileage(int mileage) {
    if (mileage >= 1000) {
      return '${(mileage / 1000).toStringAsFixed(1)}K';
    }
    return mileage.toString();
  }
}
```

### Listing Detail Screen

```dart
// lib/features/marketplace/presentation/screens/listing_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:url_launcher/url_launcher.dart';

class ListingDetailScreen extends ConsumerWidget {
  final String listingId;

  const ListingDetailScreen({
    super.key,
    required this.listingId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final listingAsync = ref.watch(listingDetailProvider(listingId));
    final currentUser = ref.watch(currentUserProvider);

    return listingAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Failed to load listing'),
              ElevatedButton(
                onPressed: () => ref.invalidate(listingDetailProvider(listingId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (listing) {
        if (listing == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Listing not found')),
          );
        }

        final isOwner = currentUser?.id == listing.seller.id;

        return Scaffold(
          body: CustomScrollView(
            slivers: [
              // Image carousel
              SliverAppBar(
                expandedHeight: 300,
                pinned: true,
                flexibleSpace: FlexibleSpaceBar(
                  background: _ImageCarousel(media: listing.media),
                ),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.share),
                    onPressed: () {
                      // TODO: Share listing
                    },
                  ),
                  if (!isOwner)
                    IconButton(
                      icon: Icon(
                        listing.isFavorited
                            ? Icons.favorite
                            : Icons.favorite_border,
                        color: listing.isFavorited ? Colors.red : null,
                      ),
                      onPressed: () {
                        if (listing.isFavorited) {
                          ref.read(listingsNotifierProvider.notifier)
                              .unfavoriteListing(listing.id);
                        } else {
                          ref.read(listingsNotifierProvider.notifier)
                              .favoriteListing(listing.id);
                        }
                      },
                    ),
                  if (isOwner)
                    PopupMenuButton(
                      itemBuilder: (context) => [
                        const PopupMenuItem(
                          value: 'edit',
                          child: Text('Edit'),
                        ),
                        const PopupMenuItem(
                          value: 'sold',
                          child: Text('Mark as Sold'),
                        ),
                        const PopupMenuItem(
                          value: 'delete',
                          child: Text('Delete'),
                        ),
                      ],
                      onSelected: (value) {
                        switch (value) {
                          case 'edit':
                            context.push('/marketplace/${listing.id}/edit');
                            break;
                          case 'sold':
                            _markAsSold(context, ref, listing.id);
                            break;
                          case 'delete':
                            _deleteListing(context, ref, listing.id);
                            break;
                        }
                      },
                    ),
                ],
              ),

              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Price & Status
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  listing.priceFormatted,
                                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                ),
                                if (listing.isNegotiable)
                                  Text(
                                    'Price negotiable',
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          if (listing.status == ListingStatus.sold)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.grey,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                'SOLD',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),

                    // Title
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        listing.title,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),

                    const SizedBox(height: 8),

                    // Quick stats
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          _QuickStat(
                            icon: Icons.calendar_today,
                            label: '${listing.motorcycle.year}',
                          ),
                          const SizedBox(width: 16),
                          _QuickStat(
                            icon: Icons.speed,
                            label: '${listing.motorcycle.mileage} km',
                          ),
                          const SizedBox(width: 16),
                          _QuickStat(
                            icon: Icons.settings,
                            label: '${listing.motorcycle.engineSize} cc',
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Location
                    if (listing.city != null || listing.location != null)
                      ListTile(
                        leading: const Icon(Icons.location_on_outlined),
                        title: Text(listing.city ?? 'Unknown location'),
                        subtitle: listing.location?.address != null
                            ? Text(listing.location!.address!)
                            : null,
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          if (listing.location != null) {
                            _openMap(listing.location!);
                          }
                        },
                      ),

                    const Divider(),

                    // Motorcycle details
                    _SectionTitle(title: 'Specifications'),
                    _SpecRow(label: 'Brand', value: listing.motorcycle.brand),
                    _SpecRow(label: 'Model', value: listing.motorcycle.model),
                    _SpecRow(label: 'Year', value: '${listing.motorcycle.year}'),
                    _SpecRow(label: 'Mileage', value: '${listing.motorcycle.mileage} km'),
                    _SpecRow(label: 'Engine', value: '${listing.motorcycle.engineSize} cc'),
                    if (listing.motorcycle.color != null)
                      _SpecRow(label: 'Color', value: listing.motorcycle.color!),
                    if (listing.motorcycle.fuelType != null)
                      _SpecRow(label: 'Fuel', value: listing.motorcycle.fuelType!.name),
                    if (listing.motorcycle.transmission != null)
                      _SpecRow(label: 'Transmission', value: listing.motorcycle.transmission!.name),
                    if (listing.motorcycle.category != null)
                      _SpecRow(label: 'Category', value: listing.motorcycle.category!.name),
                    _SpecRow(
                      label: 'Condition',
                      value: _getConditionLabel(listing.condition),
                    ),

                    const Divider(),

                    // Description
                    _SectionTitle(title: 'Description'),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(listing.description),
                    ),

                    const Divider(),

                    // Seller info
                    _SectionTitle(title: 'Seller'),
                    ListTile(
                      leading: CircleAvatar(
                        backgroundImage: listing.seller.avatarUrl != null
                            ? CachedNetworkImageProvider(listing.seller.avatarUrl!)
                            : null,
                        child: listing.seller.avatarUrl == null
                            ? Text(listing.seller.username[0].toUpperCase())
                            : null,
                      ),
                      title: Row(
                        children: [
                          Text(listing.seller.username),
                          if (listing.seller.isVerified) ...[
                            const SizedBox(width: 4),
                            const Icon(
                              Icons.verified,
                              color: AppColors.primary,
                              size: 16,
                            ),
                          ],
                        ],
                      ),
                      subtitle: Text('Member since ${_formatDate(listing.seller.createdAt)}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/profile/${listing.seller.id}'),
                    ),

                    // View stats
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Text(
                            '${listing.viewsCount} views',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Text(
                            '${listing.favoritesCount} favorites',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            'Posted ${_formatTimeAgo(listing.createdAt)}',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Bottom padding for contact buttons
                    const SizedBox(height: 80),
                  ],
                ),
              ),
            ],
          ),

          // Contact buttons
          bottomNavigationBar: listing.status != ListingStatus.sold && !isOwner
              ? SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => context.push('/chat/${listing.seller.id}'),
                            icon: const Icon(Icons.message),
                            label: const Text('Message'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _callSeller(listing.seller.phone),
                            icon: const Icon(Icons.call),
                            label: const Text('Call'),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : null,
        );
      },
    );
  }

  String _getConditionLabel(ListingCondition condition) {
    switch (condition) {
      case ListingCondition.newBike:
        return 'New';
      case ListingCondition.excellent:
        return 'Excellent';
      case ListingCondition.good:
        return 'Good';
      case ListingCondition.fair:
        return 'Fair';
      case ListingCondition.forParts:
        return 'For Parts';
    }
  }

  Future<void> _callSeller(String? phone) async {
    if (phone == null) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _openMap(Location location) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _markAsSold(BuildContext context, WidgetRef ref, String listingId) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mark as Sold?'),
        content: const Text('This will mark the listing as sold and remove it from active listings.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await ref.read(listingRepositoryProvider).markAsSold(listingId);
              ref.invalidate(listingDetailProvider(listingId));
            },
            child: const Text('Mark as Sold'),
          ),
        ],
      ),
    );
  }

  void _deleteListing(BuildContext context, WidgetRef ref, String listingId) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Listing?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await ref.read(listingRepositoryProvider).deleteListing(listingId);
              ref.invalidate(listingsNotifierProvider);
              context.pop();
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
```

---

## 4.3 Parts Catalog

### Part Entity

```dart
// lib/features/parts/domain/entities/part.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'part.freezed.dart';

@freezed
class Part with _$Part {
  const factory Part({
    required String id,
    required User seller,
    required String title,
    required String description,
    required double price,
    required PartCondition condition,
    required PartCategory category,
    required List<PartMedia> media,
    required List<MotorcycleCompatibility> compatibility,
    String? partNumber,
    String? brand,
    @Default(0) int viewsCount,
    @Default(0) int favoritesCount,
    @Default(false) bool isFavorited,
    String? city,
    required DateTime createdAt,
  }) = _Part;
}

enum PartCondition {
  newPart,
  used,
  refurbished,
}

enum PartCategory {
  engine,
  exhaust,
  brakes,
  suspension,
  electrical,
  bodywork,
  wheels,
  accessories,
  other,
}

@freezed
class MotorcycleCompatibility with _$MotorcycleCompatibility {
  const factory MotorcycleCompatibility({
    required String brand,
    required String model,
    int? yearFrom,
    int? yearTo,
  }) = _MotorcycleCompatibility;
}
```

### Parts Screen with Compatibility Search

```dart
// lib/features/parts/presentation/screens/parts_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PartsScreen extends ConsumerStatefulWidget {
  const PartsScreen({super.key});

  @override
  ConsumerState<PartsScreen> createState() => _PartsScreenState();
}

class _PartsScreenState extends ConsumerState<PartsScreen> {
  String? _selectedBrand;
  String? _selectedModel;
  int? _selectedYear;

  @override
  Widget build(BuildContext context) {
    final partsAsync = ref.watch(partsNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Parts'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.push('/parts/create'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Compatibility filter
          Card(
            margin: const EdgeInsets.all(12),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Find parts for your bike',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _BrandDropdown(
                          value: _selectedBrand,
                          onChanged: (brand) {
                            setState(() {
                              _selectedBrand = brand;
                              _selectedModel = null;
                            });
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _ModelDropdown(
                          brand: _selectedBrand,
                          value: _selectedModel,
                          onChanged: (model) {
                            setState(() => _selectedModel = model);
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 80,
                        child: _YearDropdown(
                          value: _selectedYear,
                          onChanged: (year) {
                            setState(() => _selectedYear = year);
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _search,
                      child: const Text('Search'),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Category chips
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: PartCategory.values.map((category) {
                final isSelected = ref.watch(partCategoryFilterProvider) == category;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_getCategoryLabel(category)),
                    selected: isSelected,
                    onSelected: (selected) {
                      ref.read(partCategoryFilterProvider.notifier).state =
                          selected ? category : null;
                    },
                  ),
                );
              }).toList(),
            ),
          ),

          // Parts grid
          Expanded(
            child: partsAsync.when(
              loading: () => const PartsGridShimmer(),
              error: (error, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Failed to load parts'),
                    ElevatedButton(
                      onPressed: () => ref.invalidate(partsNotifierProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (parts) {
                if (parts.isEmpty) {
                  return const Center(child: Text('No parts found'));
                }

                return GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.75,
                  ),
                  itemCount: parts.length,
                  itemBuilder: (context, index) {
                    return PartCard(part: parts[index]);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _search() {
    ref.read(partsNotifierProvider.notifier).searchByCompatibility(
      brand: _selectedBrand,
      model: _selectedModel,
      year: _selectedYear,
    );
  }

  String _getCategoryLabel(PartCategory category) {
    switch (category) {
      case PartCategory.engine:
        return 'Engine';
      case PartCategory.exhaust:
        return 'Exhaust';
      case PartCategory.brakes:
        return 'Brakes';
      case PartCategory.suspension:
        return 'Suspension';
      case PartCategory.electrical:
        return 'Electrical';
      case PartCategory.bodywork:
        return 'Bodywork';
      case PartCategory.wheels:
        return 'Wheels';
      case PartCategory.accessories:
        return 'Accessories';
      case PartCategory.other:
        return 'Other';
    }
  }
}
```

---

## 4.4 Forum

### Forum Entities

```dart
// lib/features/forum/domain/entities/forum_thread.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'forum_thread.freezed.dart';

@freezed
class ForumCategory with _$ForumCategory {
  const factory ForumCategory({
    required String id,
    required String name,
    required String description,
    String? iconUrl,
    @Default(0) int threadsCount,
    @Default(0) int postsCount,
    ForumThread? latestThread,
  }) = _ForumCategory;
}

@freezed
class ForumThread with _$ForumThread {
  const factory ForumThread({
    required String id,
    required String categoryId,
    required User author,
    required String title,
    String? content,
    @Default(false) bool isPinned,
    @Default(false) bool isLocked,
    @Default(0) int repliesCount,
    @Default(0) int viewsCount,
    ForumReply? lastReply,
    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _ForumThread;
}

@freezed
class ForumReply with _$ForumReply {
  const factory ForumReply({
    required String id,
    required String threadId,
    required User author,
    required String content,
    String? parentId,
    @Default(0) int likesCount,
    @Default(false) bool isLiked,
    List<String>? attachments,
    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _ForumReply;
}
```

### Forum Screen

```dart
// lib/features/forum/presentation/screens/forum_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ForumScreen extends ConsumerWidget {
  const ForumScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(forumCategoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Forum'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => context.push('/forum/search'),
          ),
        ],
      ),
      body: categoriesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Failed to load forum'),
              ElevatedButton(
                onPressed: () => ref.invalidate(forumCategoriesProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (categories) {
          return ListView.builder(
            itemCount: categories.length,
            itemBuilder: (context, index) {
              final category = categories[index];
              return _CategoryCard(category: category);
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/forum/create'),
        icon: const Icon(Icons.add),
        label: const Text('New Thread'),
      ),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  final ForumCategory category;

  const _CategoryCard({required this.category});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: InkWell(
        onTap: () => context.push('/forum/category/${category.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Category icon
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: category.iconUrl != null
                    ? CachedNetworkImage(
                        imageUrl: category.iconUrl!,
                        fit: BoxFit.cover,
                      )
                    : const Icon(
                        Icons.forum,
                        color: AppColors.primary,
                      ),
              ),

              const SizedBox(width: 12),

              // Category info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      category.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      category.description,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Text(
                          '${category.threadsCount} threads',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          '${category.postsCount} posts',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}
```

### Thread Detail Screen

```dart
// lib/features/forum/presentation/screens/thread_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ThreadDetailScreen extends ConsumerStatefulWidget {
  final String threadId;

  const ThreadDetailScreen({
    super.key,
    required this.threadId,
  });

  @override
  ConsumerState<ThreadDetailScreen> createState() => _ThreadDetailScreenState();
}

class _ThreadDetailScreenState extends ConsumerState<ThreadDetailScreen> {
  final _replyController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _replyController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final threadAsync = ref.watch(threadDetailProvider(widget.threadId));
    final repliesAsync = ref.watch(threadRepliesProvider(widget.threadId));
    final currentUser = ref.watch(currentUserProvider);

    return threadAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Failed to load thread')),
      ),
      data: (thread) {
        if (thread == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Thread not found')),
          );
        }

        return Scaffold(
          appBar: AppBar(
            title: Text(thread.title),
            actions: [
              if (currentUser?.id == thread.author.id)
                PopupMenuButton(
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'edit',
                      child: Text('Edit'),
                    ),
                    const PopupMenuItem(
                      value: 'delete',
                      child: Text('Delete'),
                    ),
                  ],
                  onSelected: (value) {
                    // Handle edit/delete
                  },
                ),
            ],
          ),
          body: Column(
            children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(threadDetailProvider(widget.threadId));
                    ref.invalidate(threadRepliesProvider(widget.threadId));
                  },
                  child: CustomScrollView(
                    controller: _scrollController,
                    slivers: [
                      // Thread content
                      SliverToBoxAdapter(
                        child: _ThreadContent(thread: thread),
                      ),

                      // Replies header
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Text(
                                '${thread.repliesCount} Replies',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const Spacer(),
                              DropdownButton<String>(
                                value: 'newest',
                                underline: const SizedBox(),
                                items: const [
                                  DropdownMenuItem(
                                    value: 'newest',
                                    child: Text('Newest'),
                                  ),
                                  DropdownMenuItem(
                                    value: 'oldest',
                                    child: Text('Oldest'),
                                  ),
                                  DropdownMenuItem(
                                    value: 'most_liked',
                                    child: Text('Most Liked'),
                                  ),
                                ],
                                onChanged: (value) {
                                  // TODO: Sort replies
                                },
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Replies list
                      repliesAsync.when(
                        loading: () => const SliverToBoxAdapter(
                          child: Center(child: CircularProgressIndicator()),
                        ),
                        error: (_, __) => const SliverToBoxAdapter(
                          child: Center(child: Text('Failed to load replies')),
                        ),
                        data: (replies) {
                          if (replies.isEmpty) {
                            return const SliverToBoxAdapter(
                              child: Center(
                                child: Padding(
                                  padding: EdgeInsets.all(32),
                                  child: Text('No replies yet. Be the first!'),
                                ),
                              ),
                            );
                          }

                          return SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) => _ReplyItem(
                                reply: replies[index],
                                onLike: () {
                                  ref.read(threadRepliesProvider(widget.threadId).notifier)
                                      .likeReply(replies[index].id);
                                },
                              ),
                              childCount: replies.length,
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),

              // Reply input
              if (!thread.isLocked)
                SafeArea(
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      border: Border(
                        top: BorderSide(color: AppColors.border),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _replyController,
                            decoration: InputDecoration(
                              hintText: 'Write a reply...',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(24),
                              ),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 8,
                              ),
                            ),
                            maxLines: null,
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filled(
                          onPressed: _submitReply,
                          icon: const Icon(Icons.send),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _submitReply() {
    final content = _replyController.text.trim();
    if (content.isEmpty) return;

    ref.read(threadRepliesProvider(widget.threadId).notifier).addReply(content);
    _replyController.clear();
    FocusScope.of(context).unfocus();
  }
}
```

---

## 4.5 Services Directory

### Service Entity

```dart
// lib/features/services/domain/entities/service.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'service.freezed.dart';

@freezed
class ServiceProvider with _$ServiceProvider {
  const factory ServiceProvider({
    required String id,
    required User owner,
    required String name,
    required String description,
    required ServiceCategory category,
    required List<ServiceType> services,
    required Location location,
    required String address,
    String? phone,
    String? website,
    List<String>? photos,
    WorkingHours? workingHours,
    @Default(0.0) double rating,
    @Default(0) int reviewsCount,
    @Default(false) bool isVerified,
    required DateTime createdAt,
  }) = _ServiceProvider;
}

enum ServiceCategory {
  repair,
  parts,
  customization,
  inspection,
  insurance,
  rental,
  riding_school,
  other,
}

enum ServiceType {
  general_repair,
  engine_repair,
  electrical,
  bodywork,
  paint,
  tire_service,
  suspension,
  inspection,
  customization,
  accessories,
}

@freezed
class WorkingHours with _$WorkingHours {
  const factory WorkingHours({
    DayHours? monday,
    DayHours? tuesday,
    DayHours? wednesday,
    DayHours? thursday,
    DayHours? friday,
    DayHours? saturday,
    DayHours? sunday,
  }) = _WorkingHours;
}

@freezed
class DayHours with _$DayHours {
  const factory DayHours({
    required String open,
    required String close,
    @Default(false) bool isClosed,
  }) = _DayHours;
}

@freezed
class ServiceReview with _$ServiceReview {
  const factory ServiceReview({
    required String id,
    required String serviceId,
    required User author,
    required int rating, // 1-5
    String? content,
    List<String>? photos,
    required DateTime createdAt,
  }) = _ServiceReview;
}
```

### Services Map Screen

```dart
// lib/features/services/presentation/screens/services_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';

class ServicesScreen extends ConsumerStatefulWidget {
  const ServicesScreen({super.key});

  @override
  ConsumerState<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends ConsumerState<ServicesScreen> {
  GoogleMapController? _mapController;
  Set<Marker> _markers = {};
  bool _isMapView = true;
  ServiceCategory? _selectedCategory;

  @override
  Widget build(BuildContext context) {
    final servicesAsync = ref.watch(servicesNotifierProvider);
    final userLocation = ref.watch(userLocationProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Services'),
        actions: [
          IconButton(
            icon: Icon(_isMapView ? Icons.list : Icons.map),
            onPressed: () => setState(() => _isMapView = !_isMapView),
          ),
          IconButton(
            icon: const Icon(Icons.add_business),
            onPressed: () => context.push('/services/create'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Category filter
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: const Text('All'),
                    selected: _selectedCategory == null,
                    onSelected: (_) {
                      setState(() => _selectedCategory = null);
                    },
                  ),
                ),
                ...ServiceCategory.values.map((category) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(_getCategoryLabel(category)),
                      selected: _selectedCategory == category,
                      onSelected: (selected) {
                        setState(() {
                          _selectedCategory = selected ? category : null;
                        });
                      },
                    ),
                  );
                }),
              ],
            ),
          ),

          // Map or list view
          Expanded(
            child: servicesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Failed to load services'),
                    ElevatedButton(
                      onPressed: () => ref.invalidate(servicesNotifierProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (services) {
                final filteredServices = _selectedCategory != null
                    ? services.where((s) => s.category == _selectedCategory).toList()
                    : services;

                if (_isMapView) {
                  return _buildMap(filteredServices, userLocation);
                } else {
                  return _buildList(filteredServices);
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMap(List<ServiceProvider> services, Position? userLocation) {
    _markers = services.map((service) {
      return Marker(
        markerId: MarkerId(service.id),
        position: LatLng(
          service.location.latitude,
          service.location.longitude,
        ),
        infoWindow: InfoWindow(
          title: service.name,
          snippet: '${service.rating.toStringAsFixed(1)} ★ (${service.reviewsCount})',
          onTap: () => context.push('/services/${service.id}'),
        ),
        icon: BitmapDescriptor.defaultMarkerWithHue(
          _getCategoryHue(service.category),
        ),
      );
    }).toSet();

    return GoogleMap(
      initialCameraPosition: CameraPosition(
        target: userLocation != null
            ? LatLng(userLocation.latitude, userLocation.longitude)
            : const LatLng(41.7151, 44.8271), // Tbilisi default
        zoom: 12,
      ),
      onMapCreated: (controller) => _mapController = controller,
      markers: _markers,
      myLocationEnabled: true,
      myLocationButtonEnabled: true,
    );
  }

  Widget _buildList(List<ServiceProvider> services) {
    if (services.isEmpty) {
      return const Center(child: Text('No services found'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: services.length,
      itemBuilder: (context, index) {
        return ServiceCard(service: services[index]);
      },
    );
  }

  String _getCategoryLabel(ServiceCategory category) {
    switch (category) {
      case ServiceCategory.repair:
        return 'Repair';
      case ServiceCategory.parts:
        return 'Parts';
      case ServiceCategory.customization:
        return 'Custom';
      case ServiceCategory.inspection:
        return 'Inspection';
      case ServiceCategory.insurance:
        return 'Insurance';
      case ServiceCategory.rental:
        return 'Rental';
      case ServiceCategory.riding_school:
        return 'School';
      case ServiceCategory.other:
        return 'Other';
    }
  }

  double _getCategoryHue(ServiceCategory category) {
    switch (category) {
      case ServiceCategory.repair:
        return BitmapDescriptor.hueRed;
      case ServiceCategory.parts:
        return BitmapDescriptor.hueOrange;
      case ServiceCategory.customization:
        return BitmapDescriptor.hueViolet;
      case ServiceCategory.inspection:
        return BitmapDescriptor.hueBlue;
      default:
        return BitmapDescriptor.hueGreen;
    }
  }
}
```

---

## Testing Checklist

### Marketplace Tests
- [ ] Listings load and paginate
- [ ] Search functionality works
- [ ] All filters work correctly
- [ ] Favorite/unfavorite works
- [ ] Create listing with photos
- [ ] Edit and delete listing
- [ ] Mark as sold
- [ ] Contact seller (message, call)

### Parts Tests
- [ ] Parts load and paginate
- [ ] Compatibility search works
- [ ] Category filter works
- [ ] Part detail view works
- [ ] Create part listing

### Forum Tests
- [ ] Categories load
- [ ] Threads load in category
- [ ] Thread detail and replies
- [ ] Create new thread
- [ ] Reply to thread
- [ ] Like/unlike reply

### Services Tests
- [ ] Services load on map
- [ ] Category filter works
- [ ] List view works
- [ ] Service detail view
- [ ] Reviews load
- [ ] Call/navigate to service

---

## Claude Code Prompts

### Prompt: Marketplace Screen
```
Create marketplace screen with:
1. Search bar with filter button
2. Active filter chips with clear all
3. Grid/list view toggle
4. Infinite scroll listings
5. Pull-to-refresh
6. FAB to create listing
```

### Prompt: Listing Filter Sheet
```
Create filter bottom sheet with:
1. Price range slider
2. Brand multi-select
3. Model multi-select (depends on brand)
4. Year range
5. Mileage range
6. Engine size range
7. Condition checkboxes
8. Category checkboxes
9. Sort by dropdown
10. Apply and reset buttons
```

### Prompt: Forum Thread
```
Create forum thread screen with:
1. Thread title and content
2. Author info with avatar
3. Replies list with pagination
4. Reply input at bottom
5. Like reply functionality
6. Reply to specific reply
7. Sort replies (newest, oldest, most liked)
```

### Prompt: Services Map
```
Create services map screen with:
1. Google Maps with markers
2. Custom marker colors by category
3. Info window on marker tap
4. Category filter chips
5. List view toggle
6. User location button
7. Search nearby
```
