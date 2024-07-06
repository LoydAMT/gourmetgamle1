import React, { useState, useEffect } from 'react';
import { auth, db, getUserProfile, uploadProfilePicture } from './firebaseConfig';
import { collection, getDocs, query, where, updateDoc, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useParams, Link } from 'react-router-dom';
import './Profile.css';

function Profile() {
  const { userId } = useParams();
  const [profileUser, setProfileUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState('');
  const [newProfilePicture, setNewProfilePicture] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfileData = async (uid) => {
      try {
        const userProfile = await getUserProfile(uid);
        if (userProfile) {
          setProfileUser({
            uid: uid,
            name: userProfile.name || '',
            email: userProfile.email || '',
            profilePicture: userProfile.profilePicture || '',
          });
          setProfilePicture(userProfile.profilePicture || '');

          // Fetch user recipes
          const recipeQuery = query(collection(db, 'recipes'), where('userId', '==', uid));
          const recipeQuerySnapshot = await getDocs(recipeQuery);
          const userRecipes = recipeQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setRecipes(userRecipes);

          // Fetch user favorites
          if (userProfile.favorites) {
            const favoriteRecipes = [];
            for (const favoriteId of userProfile.favorites) {
              const favoriteDoc = await getDoc(doc(db, 'recipes', favoriteId));
              if (favoriteDoc.exists()) {
                favoriteRecipes.push({ id: favoriteDoc.id, ...favoriteDoc.data() });
              }
            }
            setFavorites(favoriteRecipes);
          }

          // Fetch following users
          if (userProfile.following && userProfile.following.length > 0) {
            const followingQuery = query(collection(db, 'users'), where('uid', 'in', userProfile.following));
            const followingSnapshot = await getDocs(followingQuery);
            const followingUsers = followingSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setFollowing(followingUsers);
          } else {
            setFollowing([]);
          }

          // Fetch followers
          const followersQuery = query(collection(db, 'users'), where('following', 'array-contains', uid));
          const followersSnapshot = await getDocs(followersQuery);
          const userFollowers = followersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
          setFollowers(userFollowers);
        } else {
          setError('User profile not found.');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Error fetching user data. Please try again later.');
      }
    };

    if (userId) {
      fetchProfileData(userId);
    } else {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          setCurrentUser(user);
          fetchProfileData(user.uid);
        } else {
          setCurrentUser(null);
        }
      });
    }
  }, [userId]);

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProfilePicture(URL.createObjectURL(file));
    }
  };

  const handleSaveProfilePicture = async () => {
    if (newProfilePicture && currentUser) {
      const file = document.querySelector('input[type="file"]').files[0];
      try {
        const url = await uploadProfilePicture(file, currentUser.uid);
        const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userRef = doc(db, 'users', userDoc.id);
          await updateDoc(userRef, { profilePicture: url });
          setProfilePicture(url);
          setProfileUser((prev) => ({ ...prev, profilePicture: url }));
          setNewProfilePicture(null);
          setError('');
        } else {
          setError('User document does not exist. Please ensure your user profile is set up correctly.');
        }
      } catch (error) {
        setError('Error uploading profile picture. Please try again.');
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
  };

  const handleCloseModal = () => {
    setSelectedRecipe(null);
  };

  const handleFollow = async (followedUserId) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        let updatedFollowing;
        if (following.some(followingUser => followingUser.uid === followedUserId)) {
          updatedFollowing = userData.following.filter(id => id !== followedUserId);
        } else {
          updatedFollowing = [...userData.following, followedUserId];
        }

        await updateDoc(userRef, { following: updatedFollowing });
        setFollowing(updatedFollowing);
      }
    } catch (error) {
      console.error('Error following user:', error);
      setError('Error following user. Please try again later.');
    }
  };

  return (
    <div className="profile-container">
      {error && <div className="error-bar">{error}</div>}
      {profileUser ? (
        <>
          <h1>{profileUser.name}'s Profile</h1>
          <div className="profile-info">
            <img
              src={newProfilePicture || profilePicture || 'default-profile.png'}
              alt="Profile"
              className="profile-picture"
            />
            {!userId && (
              <div className="profile-upload">
                <input type="file" accept="image/*" onChange={handleProfilePictureChange} />
                {newProfilePicture && (
                  <button onClick={handleSaveProfilePicture} className="save-button">Save</button>
                )}
              </div>
            )}
          </div>
          {error && <p className="error-message">{error}</p>}
          {!userId && (
            <div>
              <button onClick={handleLogout} className="logout-button">Logout</button>
              <button onClick={() => setShowFollowing(!showFollowing)} className="show-button">
                {showFollowing ? 'Hide Following' : 'Show Following'}
              </button>
              <button onClick={() => setShowFollowers(!showFollowers)} className="show-button">
                {showFollowers ? 'Hide Followers' : 'Show Followers'}
              </button>
            </div>
          )}

          <h2>{userId ? `${profileUser.name}'s` : 'Your'} Recipes</h2>
          <div className="recipes-container">
            {recipes.map(recipe => (
              <div key={recipe.id} className="recipe-card" onClick={() => handleRecipeClick(recipe)}>
                <img src={recipe.photo} alt={recipe.nameOfDish} className="recipe-photo" />
                <p>{recipe.nameOfDish}</p>
              </div>
            ))}
          </div>

          <h2>{userId ? `${profileUser.name}'s` : 'Your'} Favorites</h2>
          <div className="recipes-container">
            {favorites.map(recipe => (
              <div key={recipe.id} className="recipe-card" onClick={() => handleRecipeClick(recipe)}>
                <img src={recipe.photo} alt={recipe.nameOfDish} className="recipe-photo" />
                <p>{recipe.nameOfDish}</p>
              </div>
            ))}
          </div>

          {showFollowing && (
            <>
              <h2>Following ({following.length})</h2>
              {following.length > 0 ? (
                <div className="recipes-container">
                  {following.map(user => (
                    <div key={user.uid} className="recipe-card">
                      <Link to={`/profile/${user.uid}`}>
                        <img src={user.profilePicture || 'default-profile.png'} alt="Profile" className="profile-picture" />
                        <p>{user.name}</p>
                      </Link>
                      {!userId && (
                        <button className="follow-button" onClick={() => handleFollow(user.uid)}>
                          {following.some(followingUser => followingUser.uid === user.uid) ? 'Unfollow' : 'Follow'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>You are not following anyone yet.</p>
              )}
            </>
          )}

          {showFollowers && (
            <>
              <h2>Followers ({followers.length})</h2>
              {followers.length > 0 ? (
                <div className="recipes-container">
                  {followers.map(user => (
                    <div key={user.uid} className="recipe-card">
                      <Link to={`/profile/${user.uid}`}>
                        <img src={user.profilePicture || 'default-profile.png'} alt="Profile" className="profile-picture" />
                        <p>{user.name}</p>
                      </Link>
                      {!userId && (
                        <button className="follow-button" onClick={() => handleFollow(user.uid)}>
                          {following.some(followingUser => followingUser.uid === user.uid) ? 'Unfollow' : 'Follow'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>You don't have any followers yet.</p>
              )}
            </>
          )}

          {selectedRecipe && (
            <div className="modalBackground">
              <div className="modalContainer">
                <h2>{selectedRecipe.nameOfDish}</h2>
                <p><strong>Description:</strong> {selectedRecipe.description}</p>
                <p><strong>Origin:</strong> {selectedRecipe.origin}</p>
                <p><strong>Ingredients:</strong> {selectedRecipe.ingredients.join(', ')}</p>
                <p><strong>Steps:</strong></p>
                <ul>
                  {selectedRecipe.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
                <button onClick={handleCloseModal} className="button closeModalButton">Close</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p>Please log in to view your profile.</p>
      )}
    </div>
  );
}

export default Profile;
